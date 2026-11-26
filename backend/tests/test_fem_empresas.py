"""Empresas colaboradoras FEM y su geocodificación (Nominatim simulado)."""

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
from app.services import auth_service, geocodificacion, usuario_service

LLAMADAS: list[tuple[str, str]] = []


async def _geo_falso(direccion: str, municipio: str) -> tuple[float, float] | None:
    LLAMADAS.append((direccion, municipio))
    if "Inexistente" in direccion:
        return None
    return {"Lorca": (37.677, -1.700), "Águilas": (37.406, -1.583)}.get(municipio, (38.0, -1.1))


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    monkeypatch.setattr(geocodificacion, "geocodificar", _geo_falso)
    LLAMADAS.clear()
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            db = get_db()
            for col in ("usuarios", "auditoria", "fem_empresas", "fem_alumnos"):
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


EMPRESA = {"nombre": "Nexo Software", "direccion": "Calle Mayor 1", "municipio": "Lorca", "ciclos": ["DAW", "SMR"]}


@pytest.mark.asyncio
async def test_alta_geocodifica_y_filtra(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    admin = await _activate(client, monkeypatch, "a@x.com", [Role.admin])
    res = await client.post("/api/v1/fem/empresas", headers=admin, json=EMPRESA)
    assert res.status_code == 201
    body = res.json()
    assert body["geocodificada"] is True
    assert (body["lat"], body["lon"]) == (37.677, -1.700)
    assert LLAMADAS == [("Calle Mayor 1", "Lorca")]

    otra = {**EMPRESA, "nombre": "Puerto Web", "municipio": "Águilas", "ciclos": ["DAM"], "activa": False}
    await client.post("/api/v1/fem/empresas", headers=admin, json=otra)

    todas = (await client.get("/api/v1/fem/empresas", headers=admin)).json()
    assert [e["nombre"] for e in todas] == ["Nexo Software", "Puerto Web"]
    assert [e["nombre"] for e in (await client.get("/api/v1/fem/empresas?ciclo=DAW", headers=admin)).json()] == [
        "Nexo Software"
    ]
    assert [e["nombre"] for e in (await client.get("/api/v1/fem/empresas?activa=false", headers=admin)).json()] == [
        "Puerto Web"
    ]


@pytest.mark.asyncio
async def test_direccion_no_encontrada_y_reintento(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    admin = await _activate(client, monkeypatch, "a@x.com", [Role.admin])
    res = await client.post("/api/v1/fem/empresas", headers=admin, json={**EMPRESA, "direccion": "Calle Inexistente"})
    assert res.status_code == 201
    empresa = res.json()
    assert empresa["geocodificada"] is False
    assert empresa["lat"] is None

    # Al corregir la dirección se vuelve a geocodificar.
    arreglada = await client.patch(
        f"/api/v1/fem/empresas/{empresa['id']}", headers=admin, json={"direccion": "Calle Mayor 2"}
    )
    assert arreglada.json()["geocodificada"] is True

    # Reintento manual que falla: conserva las coordenadas válidas.
    await get_db()["fem_empresas"].update_one({}, {"$set": {"direccion": "Calle Inexistente"}})
    reintento = await client.post(f"/api/v1/fem/empresas/{empresa['id']}/geocodificar", headers=admin)
    assert reintento.json()["geocodificada"] is True


@pytest.mark.asyncio
async def test_alumnado_por_empresa_y_cambio_de_nombre(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    admin = await _activate(client, monkeypatch, "a@x.com", [Role.admin])
    eid = (await client.post("/api/v1/fem/empresas", headers=admin, json=EMPRESA)).json()["id"]
    await get_db()["fem_alumnos"].insert_many(
        [
            {"nombre": "A", "empresa": "Nexo Software", "empresa_id": eid, "estado": "activo", "ciclo": "DAW"},
            {"nombre": "B", "empresa": "Nexo Software", "empresa_id": eid, "estado": "finalizado", "ciclo": "DAW"},
        ]
    )
    empresas = (await client.get("/api/v1/fem/empresas", headers=admin)).json()
    assert empresas[0]["alumnos"] == 1  # solo en prácticas ahora

    await client.patch(f"/api/v1/fem/empresas/{eid}", headers=admin, json={"nombre": "Nexo Digital"})
    alumnos = (await client.get("/api/v1/fem/alumnos", headers=admin)).json()
    assert {a["empresa"] for a in alumnos} == {"Nexo Digital"}
    assert alumnos[0]["empresa_id"] == eid


@pytest.mark.asyncio
async def test_permisos(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    directiva = await _activate(client, monkeypatch, "d@x.com", [Role.directiva])
    tutor = await _activate(client, monkeypatch, "t@x.com", [Role.tutor])
    docente = await _activate(client, monkeypatch, "doc@x.com", [Role.docente])
    assert (await client.get("/api/v1/fem/empresas", headers=directiva)).status_code == 200
    assert (await client.get("/api/v1/fem/empresas", headers=tutor)).status_code == 200
    assert (await client.get("/api/v1/fem/empresas", headers=docente)).status_code == 403
    assert (await client.post("/api/v1/fem/empresas", headers=tutor, json=EMPRESA)).status_code == 403
    assert (
        await client.post("/api/v1/fem/empresas", headers=docente, json={**EMPRESA, "extra": 1})
    ).status_code == 403
