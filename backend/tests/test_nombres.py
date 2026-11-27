"""Las respuestas incluyen el nombre del personal además de su identificador."""

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
            for col in ("usuarios", "auditoria", "tickets", "ticket_comentarios", "anuncios"):
                await db[col].delete_many({})
            redis = get_redis()
            async for key in redis.scan_iter("refresh:*"):
                await redis.delete(key)
            yield ac


async def _activate(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch, email: str, name: str, roles: list[Role], competencias=None
) -> dict[str, str]:
    claims = {"email": email, "sub": f"g-{email}", "name": name, "email_verified": True}
    monkeypatch.setattr(auth_service, "verify_google_id_token", lambda _t: claims)
    login = await client.post("/api/v1/auth/google", json={"id_token": "x"})
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    await usuario_service.patch_usuario(
        get_db(),
        me.json()["id"],
        UsuarioPatch(roles=roles, estado=UsuarioEstado.activo, competencias=competencias or []),
    )
    login2 = await client.post("/api/v1/auth/google", json={"id_token": "x"})
    return {"Authorization": f"Bearer {login2.json()['access_token']}"}


@pytest.mark.asyncio
async def test_nombres_en_tickets_comentarios_y_anuncios(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _activate(client, monkeypatch, "r@x.com", "Rosa Responsable", [Role.responsable_ticket], ["rmi"])
    dir_h = await _activate(client, monkeypatch, "d@x.com", "Diego Directivo", [Role.directiva, Role.docente])

    t = await client.post(
        "/api/v1/tickets",
        headers=dir_h,
        json={"tipo": "rmi", "titulo": "PC", "datos": {"aula": "A1", "dispositivos": "PC"}},
    )
    assert t.json()["solicitante_nombre"] == "Diego Directivo"
    assert t.json()["asignado_nombre"] == "Rosa Responsable"

    listado = await client.get("/api/v1/tickets", headers=dir_h)
    assert listado.json()[0]["asignado_nombre"] == "Rosa Responsable"

    c = await client.post(f"/api/v1/tickets/{t.json()['id']}/comentarios", headers=dir_h, json={"cuerpo": "Hola"})
    assert c.json()["autor_nombre"] == "Diego Directivo"

    a = await client.post("/api/v1/anuncios", headers=dir_h, json={"titulo": "T", "cuerpo": "C"})
    assert a.json()["autor_nombre"] == "Diego Directivo"
    feed = await client.get("/api/v1/anuncios", headers=dir_h)
    assert feed.json()[0]["autor_nombre"] == "Diego Directivo"
