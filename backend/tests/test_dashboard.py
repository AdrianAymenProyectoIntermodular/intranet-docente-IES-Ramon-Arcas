"""Indicadores del dashboard directivo: KPI 7 (RRSS) y KPI 3 (retrasos con umbral). Requiere Mongo + Redis."""

import os
from collections.abc import AsyncIterator
from typing import Any

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

COLECCIONES = ("usuarios", "auditoria", "tickets", "alumnos", "retrasos", "configuracion")


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            db = get_db()
            for col in COLECCIONES:
                await db[col].delete_many({})
            redis = get_redis()
            async for key in redis.scan_iter("refresh:*"):
                await redis.delete(key)
            yield ac


async def _activate(client: AsyncClient, monkeypatch: pytest.MonkeyPatch, email: str, roles: list[Role]) -> dict[str, str]:
    claims = {"email": email, "sub": f"g-{email}", "name": email.split("@")[0], "email_verified": True}
    monkeypatch.setattr(auth_service, "verify_google_id_token", lambda _t: claims)
    login = await client.post("/api/v1/auth/google", json={"id_token": "x"})
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    await usuario_service.patch_usuario(get_db(), me.json()["id"], UsuarioPatch(roles=roles, estado=UsuarioEstado.activo))
    login2 = await client.post("/api/v1/auth/google", json={"id_token": "x"})
    return {"Authorization": f"Bearer {login2.json()['access_token']}"}


def _rrss(departamento: str, estado: str) -> dict[str, Any]:
    return {"tipo": "rrss", "estado": estado, "titulo": "t", "solicitante_id": "u", "datos": {"departamento": departamento}}


@pytest.mark.asyncio
async def test_kpi_rrss_por_departamento(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    await get_db()["tickets"].insert_many(
        [
            _rrss("Informática", "cerrado"),
            _rrss("Informática", "resuelto"),
            _rrss("Informática", "abierto"),
            _rrss("Física y Química", "en_proceso"),
            {"tipo": "rmi", "estado": "cerrado", "titulo": "t", "solicitante_id": "u", "datos": {}},
        ]
    )
    directiva = await _activate(client, monkeypatch, "d@x.com", [Role.directiva])
    res = await client.get("/api/v1/dashboard/rrss", headers=directiva)
    assert res.status_code == 200
    body = res.json()
    assert (body["total"], body["publicadas"], body["porcentaje"]) == (4, 2, 50.0)
    assert body["por_departamento"] == [
        {"nombre": "Informática", "total": 3, "publicadas": 2, "porcentaje": 66.7},
        {"nombre": "Física y Química", "total": 1, "publicadas": 0, "porcentaje": 0.0},
    ]


@pytest.mark.asyncio
async def test_kpi_rrss_solo_direccion(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    docente = await _activate(client, monkeypatch, "doc@x.com", [Role.docente])
    assert (await client.get("/api/v1/dashboard/rrss", headers=docente)).status_code == 403
