"""KPI FEM del dashboard directivo."""

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


@pytest.mark.asyncio
async def test_kpi_fem(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    db = get_db()
    await db["fem_empresas"].insert_many(
        [
            {"nombre": "A", "direccion": "x", "municipio": "Lorca", "ciclos": ["DAW", "SMR"], "activa": True},
            {"nombre": "B", "direccion": "x", "municipio": "Lorca", "ciclos": ["DAW"], "activa": False},
            {"nombre": "C", "direccion": "x", "municipio": "Águilas", "ciclos": ["SMR"], "activa": True},
        ]
    )
    await db["fem_alumnos"].insert_many(
        [
            {"nombre": "a1", "horas_cursadas": 250, "horas_totales": 500},
            {"nombre": "a2", "horas_cursadas": 500, "horas_totales": 500},
        ]
    )
    directiva = await _activate(client, monkeypatch, "d@x.com", [Role.directiva])
    res = await client.get("/api/v1/dashboard/fem", headers=directiva)
    assert res.status_code == 200
    body = res.json()
    assert (body["empresas_total"], body["empresas_activas"], body["porcentaje_activas"]) == (3, 2, 66.7)
    municipios = {m["nombre"]: m for m in body["por_municipio"]}
    assert municipios["Lorca"] == {"nombre": "Lorca", "total": 2, "activas": 1, "porcentaje": 50.0}
    ciclos = {c["nombre"]: c for c in body["por_ciclo"]}
    assert ciclos["SMR"]["porcentaje"] == 100.0
    assert ciclos["DAW"]["activas"] == 1
    assert body["horas"] == {"alumnos": 2, "cursadas": 750.0, "previstas": 1000.0, "porcentaje": 75.0}


@pytest.mark.asyncio
async def test_kpi_fem_vacio_y_permisos(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    admin = await _activate(client, monkeypatch, "a@x.com", [Role.admin])
    vacio = (await client.get("/api/v1/dashboard/fem", headers=admin)).json()
    assert vacio["porcentaje_activas"] == 0.0
    assert vacio["horas"]["porcentaje"] == 0.0
    tutor = await _activate(client, monkeypatch, "t@x.com", [Role.tutor])
    assert (await client.get("/api/v1/dashboard/fem", headers=tutor)).status_code == 403
