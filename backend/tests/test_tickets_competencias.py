"""Asignación de solicitudes al responsable según su tipo (competencias)."""

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
from app.services import auth_service, usuario_service


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            db = get_db()
            for col in ("usuarios", "auditoria", "tickets", "ticket_comentarios"):
                await db[col].delete_many({})
            redis = get_redis()
            async for key in redis.scan_iter("refresh:*"):
                await redis.delete(key)
            yield ac


async def _activate_as(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    *,
    email: str,
    roles: list[Role],
    competencias: list[str] | None = None,
) -> tuple[dict[str, str], str]:
    sub = f"g-{email}"
    claims = {"email": email, "sub": sub, "name": email.split("@")[0], "email_verified": True}
    monkeypatch.setattr(auth_service, "verify_google_id_token", lambda _t: claims)
    login = await client.post("/api/v1/auth/google", json={"id_token": f"fake-{sub}"})
    access = login.json()["access_token"]
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    user_id = me.json()["id"]
    await usuario_service.patch_usuario(
        get_db(),
        user_id,
        UsuarioPatch(roles=roles, estado=UsuarioEstado.activo, competencias=competencias or []),
    )
    login2 = await client.post("/api/v1/auth/google", json={"id_token": f"fake-{sub}"})
    return {"Authorization": f"Bearer {login2.json()['access_token']}"}, user_id


async def _crear(client: AsyncClient, headers: dict[str, str], tipo: str, titulo: str = "Prueba") -> dict:
    res = await client.post("/api/v1/tickets", headers=headers, json={"tipo": tipo, "titulo": titulo})
    assert res.status_code == 201
    return res.json()


@pytest.mark.asyncio
async def test_autoasigna_al_responsable_del_tipo(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _, rmi_id = await _activate_as(client, monkeypatch, email="rmi@x.com", roles=[Role.responsable_ticket], competencias=["rmi"])
    _, comp_id = await _activate_as(
        client, monkeypatch, email="sec@x.com", roles=[Role.responsable_ticket], competencias=["compras", "rrss"]
    )
    doc, _ = await _activate_as(client, monkeypatch, email="doc@x.com", roles=[Role.docente])

    assert (await _crear(client, doc, "rmi"))["asignado_id"] == rmi_id
    assert (await _crear(client, doc, "compras"))["asignado_id"] == comp_id
    assert (await _crear(client, doc, "rrss"))["asignado_id"] == comp_id
    # Sin responsable para "otro": queda libre.
    assert (await _crear(client, doc, "otro"))["asignado_id"] is None


@pytest.mark.asyncio
async def test_reparte_por_carga(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _, a_id = await _activate_as(client, monkeypatch, email="a@x.com", roles=[Role.responsable_ticket], competencias=["rmi"])
    _, b_id = await _activate_as(client, monkeypatch, email="b@x.com", roles=[Role.responsable_ticket], competencias=["rmi"])
    doc, _ = await _activate_as(client, monkeypatch, email="doc@x.com", roles=[Role.docente])

    asignados = [(await _crear(client, doc, "rmi", f"T{i}"))["asignado_id"] for i in range(4)]
    assert asignados.count(a_id) == 2
    assert asignados.count(b_id) == 2


@pytest.mark.asyncio
async def test_responsable_sin_competencia_no_gestiona(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    rmi, _ = await _activate_as(client, monkeypatch, email="rmi@x.com", roles=[Role.responsable_ticket], competencias=["rmi"])
    doc, _ = await _activate_as(client, monkeypatch, email="doc@x.com", roles=[Role.docente])
    compra = await _crear(client, doc, "compras")

    res = await client.patch(f"/api/v1/tickets/{compra['id']}", headers=rmi, json={"estado": "en_proceso"})
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_reasignacion(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    rmi, rmi_id = await _activate_as(client, monkeypatch, email="rmi@x.com", roles=[Role.responsable_ticket], competencias=["rmi"])
    _, rmi2_id = await _activate_as(client, monkeypatch, email="rmi2@x.com", roles=[Role.responsable_ticket], competencias=["rmi"])
    _, comp_id = await _activate_as(client, monkeypatch, email="sec@x.com", roles=[Role.responsable_ticket], competencias=["compras"])
    admin, _ = await _activate_as(client, monkeypatch, email="admin@x.com", roles=[Role.admin])
    doc, _ = await _activate_as(client, monkeypatch, email="doc@x.com", roles=[Role.docente])
    ticket = await _crear(client, doc, "rmi")

    # Admin no puede asignar a alguien sin la competencia del tipo.
    mal = await client.patch(f"/api/v1/tickets/{ticket['id']}", headers=admin, json={"asignado_id": comp_id})
    assert mal.status_code == 422

    destino = rmi2_id if ticket["asignado_id"] == rmi_id else rmi_id
    ok = await client.patch(f"/api/v1/tickets/{ticket['id']}", headers=admin, json={"asignado_id": destino})
    assert ok.status_code == 200
    assert ok.json()["asignado_id"] == destino

    # Un responsable no puede pasar la solicitud a otra persona.
    if destino == rmi_id:
        otro = await client.patch(f"/api/v1/tickets/{ticket['id']}", headers=rmi, json={"asignado_id": rmi2_id})
        assert otro.status_code == 403


@pytest.mark.asyncio
async def test_competencias_en_usuario(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    admin, _ = await _activate_as(client, monkeypatch, email="admin@x.com", roles=[Role.admin])
    _, uid = await _activate_as(client, monkeypatch, email="r@x.com", roles=[Role.responsable_ticket])

    res = await client.patch(
        f"/api/v1/usuarios/{uid}", headers=admin, json={"competencias": ["rrss", "rmi", "rrss"]}
    )
    assert res.status_code == 200
    assert res.json()["competencias"] == ["rrss", "rmi"]

    invalido = await client.patch(f"/api/v1/usuarios/{uid}", headers=admin, json={"competencias": ["cocina"]})
    assert invalido.status_code == 422

    traza = await get_db()["auditoria"].find_one({"accion": "usuarios.patch", "recurso_id": uid})
    assert traza["detalle"]["despues"]["competencias"] == ["rrss", "rmi"]
