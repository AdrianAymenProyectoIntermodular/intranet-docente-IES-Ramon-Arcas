"""Adjuntos de tickets: validación, permisos, descarga y borrado (GridFS)."""

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017")
os.environ.setdefault("MONGODB_DB", "intranet_docente_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/1")
os.environ.setdefault("JWT_SECRET", "test-secret-at-least-32-characters!!")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client-id")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("ENVIRONMENT", "development")

from app.core.config import get_settings

get_settings.cache_clear()

from app.core.database import get_db, get_redis
from app.main import app
from app.models.usuario import Role, UsuarioEstado, UsuarioPatch
from app.services import adjunto_service, auth_service, usuario_service

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
PDF = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\n"


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            db = get_db()
            for col in ("usuarios", "auditoria", "tickets", "adjuntos.files", "adjuntos.chunks"):
                await db[col].delete_many({})
            redis = get_redis()
            async for key in redis.scan_iter("refresh:*"):
                await redis.delete(key)
            yield ac


async def _activate(client: AsyncClient, monkeypatch: pytest.MonkeyPatch, email: str, roles: list[Role]) -> dict:
    claims = {"email": email, "sub": f"g-{email}", "name": email.split("@")[0], "email_verified": True}
    monkeypatch.setattr(auth_service, "verify_google_id_token", lambda _t: claims)
    login = await client.post("/api/v1/auth/google", json={"id_token": "x"})
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    await usuario_service.patch_usuario(get_db(), me.json()["id"], UsuarioPatch(roles=roles, estado=UsuarioEstado.activo))
    login2 = await client.post("/api/v1/auth/google", json={"id_token": "x"})
    return {"Authorization": f"Bearer {login2.json()['access_token']}"}


async def _ticket(client: AsyncClient, h: dict, tipo: str = "rrss") -> str:
    datos = {
        "rrss": {"departamento": "Informática"},
        "compras": {"articulos": "Cables", "precio_total": 10},
    }[tipo]
    res = await client.post("/api/v1/tickets", headers=h, json={"tipo": tipo, "titulo": "T", "datos": datos})
    return res.json()["id"]


def _file(nombre: str, contenido: bytes, mime: str) -> dict:
    return {"archivo": (nombre, contenido, mime)}


@pytest.mark.asyncio
async def test_subir_descargar_y_borrar(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc = await _activate(client, monkeypatch, "d@x.com", [Role.docente])
    tid = await _ticket(client, doc)

    res = await client.post(f"/api/v1/tickets/{tid}/adjuntos", headers=doc, files=_file("../../foto.png", PNG, "image/png"))
    assert res.status_code == 201
    meta = res.json()
    assert meta["nombre"] == "foto.png"  # sin rutas
    assert meta["tipo_mime"] == "image/png"
    assert res.headers["Location"].endswith(meta["id"])

    ticket = await client.get("/api/v1/tickets", headers=doc)
    assert ticket.json()[0]["adjuntos"][0]["id"] == meta["id"]

    bajada = await client.get(f"/api/v1/tickets/{tid}/adjuntos/{meta['id']}", headers=doc)
    assert bajada.status_code == 200
    assert bajada.content == PNG
    assert bajada.headers["content-type"] == "image/png"
    assert bajada.headers["x-content-type-options"] == "nosniff"

    borrado = await client.delete(f"/api/v1/tickets/{tid}/adjuntos/{meta['id']}", headers=doc)
    assert borrado.status_code == 204
    assert (await client.get(f"/api/v1/tickets/{tid}/adjuntos/{meta['id']}", headers=doc)).status_code == 404
    assert await get_db()["adjuntos.files"].count_documents({}) == 0
    acciones = {a["accion"] async for a in get_db()["auditoria"].find({"recurso_id": tid})}
    assert {"tickets.adjunto_create", "tickets.adjunto_delete"} <= acciones


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tipo", "nombre", "contenido", "mime"),
    [
        ("rrss", "doc.pdf", PDF, "application/pdf"),  # RRSS solo imágenes
        ("rrss", "falsa.png", b"<script>alert(1)</script>", "image/png"),  # bytes no PNG
        ("rrss", "foto.jpg", PNG, "image/png"),  # extensión no cuadra con el contenido
        ("compras", "virus.exe", b"MZ\x90\x00", "application/octet-stream"),
    ],
)
async def test_rechaza_formatos(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, tipo: str, nombre: str, contenido: bytes, mime: str
) -> None:
    doc = await _activate(client, monkeypatch, "d@x.com", [Role.docente])
    tid = await _ticket(client, doc, tipo)
    res = await client.post(f"/api/v1/tickets/{tid}/adjuntos", headers=doc, files=_file(nombre, contenido, mime))
    assert res.status_code == 415


@pytest.mark.asyncio
async def test_compras_admite_pdf(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc = await _activate(client, monkeypatch, "d@x.com", [Role.docente])
    tid = await _ticket(client, doc, "compras")
    res = await client.post(
        f"/api/v1/tickets/{tid}/adjuntos", headers=doc, files=_file("presupuesto.pdf", PDF, "application/pdf")
    )
    assert res.status_code == 201


@pytest.mark.asyncio
async def test_tamano_y_limite(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc = await _activate(client, monkeypatch, "d@x.com", [Role.docente])
    tid = await _ticket(client, doc)
    grande = PNG + b"\x00" * adjunto_service.MAX_BYTES
    res = await client.post(f"/api/v1/tickets/{tid}/adjuntos", headers=doc, files=_file("g.png", grande, "image/png"))
    assert res.status_code == 413

    for i in range(adjunto_service.MAX_POR_TICKET):
        ok = await client.post(f"/api/v1/tickets/{tid}/adjuntos", headers=doc, files=_file(f"{i}.png", PNG, "image/png"))
        assert ok.status_code == 201
    extra = await client.post(f"/api/v1/tickets/{tid}/adjuntos", headers=doc, files=_file("x.png", PNG, "image/png"))
    assert extra.status_code == 409


@pytest.mark.asyncio
async def test_permisos(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    autor = await _activate(client, monkeypatch, "a@x.com", [Role.docente])
    otro = await _activate(client, monkeypatch, "o@x.com", [Role.docente])
    admin = await _activate(client, monkeypatch, "adm@x.com", [Role.admin])
    tid = await _ticket(client, autor)

    assert (
        await client.post(f"/api/v1/tickets/{tid}/adjuntos", headers=otro, files=_file("f.png", PNG, "image/png"))
    ).status_code == 403
    meta = (
        await client.post(f"/api/v1/tickets/{tid}/adjuntos", headers=autor, files=_file("f.png", PNG, "image/png"))
    ).json()
    assert (await client.get(f"/api/v1/tickets/{tid}/adjuntos/{meta['id']}", headers=otro)).status_code == 403
    assert (await client.delete(f"/api/v1/tickets/{tid}/adjuntos/{meta['id']}", headers=otro)).status_code == 403
    assert (await client.get(f"/api/v1/tickets/{tid}/adjuntos/{meta['id']}", headers=admin)).status_code == 200
    assert (await client.delete(f"/api/v1/tickets/{tid}/adjuntos/{meta['id']}", headers=admin)).status_code == 204
