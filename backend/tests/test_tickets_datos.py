"""Campo flexible `datos` de los tickets, validado según su tipo."""

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
async def headers(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[tuple[AsyncClient, dict[str, str]]]:
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            db = get_db()
            for col in ("usuarios", "auditoria", "tickets"):
                await db[col].delete_many({})
            redis = get_redis()
            async for key in redis.scan_iter("refresh:*"):
                await redis.delete(key)
            claims = {"email": "d@x.com", "sub": "g-d", "name": "Docente", "email_verified": True}
            monkeypatch.setattr(auth_service, "verify_google_id_token", lambda _t: claims)
            login = await client.post("/api/v1/auth/google", json={"id_token": "fake"})
            access = login.json()["access_token"]
            me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
            await usuario_service.patch_usuario(
                db, me.json()["id"], UsuarioPatch(roles=[Role.docente], estado=UsuarioEstado.activo)
            )
            login2 = await client.post("/api/v1/auth/google", json={"id_token": "fake"})
            yield client, {"Authorization": f"Bearer {login2.json()['access_token']}"}


@pytest.mark.asyncio
async def test_datos_validos_por_tipo(headers: tuple[AsyncClient, dict[str, str]]) -> None:
    client, h = headers
    res = await client.post(
        "/api/v1/tickets",
        headers=h,
        json={
            "tipo": "compras",
            "titulo": "Portátiles",
            "datos": {"articulos": "2 portátiles", "precio_total": 1200.5, "requiere_presupuesto": True},
        },
    )
    assert res.status_code == 201
    assert res.json()["datos"] == {
        "articulos": "2 portátiles",
        "precio_total": 1200.5,
        "requiere_presupuesto": True,
    }
    # Se persiste y se devuelve en el listado.
    listado = await client.get("/api/v1/tickets?tipo=compras", headers=h)
    assert listado.json()[0]["datos"]["precio_total"] == 1200.5


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("tipo", "datos"),
    [
        ("rmi", {}),  # faltan aula y dispositivos
        ("rmi", {"aula": "A1", "dispositivos": "PC", "extra": "x"}),  # campo no permitido
        ("compras", {"articulos": "Cables", "precio_total": -1}),  # precio negativo
        ("rrss", {"departamento": ""}),  # vacío
        ("rrss", {"departamento": "Informática", "borrador": {"texto": "x"}}),  # el borrador no lo pone el cliente
        ("otro", {"aula": "A1"}),
    ],
)
async def test_datos_invalidos(headers: tuple[AsyncClient, dict[str, str]], tipo: str, datos: dict) -> None:
    client, h = headers
    res = await client.post("/api/v1/tickets", headers=h, json={"tipo": tipo, "titulo": "X", "datos": datos})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_otro_sin_datos(headers: tuple[AsyncClient, dict[str, str]]) -> None:
    client, h = headers
    res = await client.post("/api/v1/tickets", headers=h, json={"tipo": "otro", "titulo": "Consulta"})
    assert res.status_code == 201
    assert res.json()["datos"] == {}
