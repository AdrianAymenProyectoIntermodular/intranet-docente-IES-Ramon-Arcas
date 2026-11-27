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


@pytest.mark.asyncio
async def test_umbral_retrasos_configurable(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """El umbral de "tasa alta" lo fija dirección; nunca es un valor fijo en código (memoria 5.11)."""
    docente = await _activate(client, monkeypatch, "doc@x.com", [Role.docente])
    directiva = await _activate(client, monkeypatch, "dir@x.com", [Role.directiva])

    inicial = await client.get("/api/v1/dashboard/configuracion", headers=directiva)
    assert inicial.status_code == 200
    assert inicial.json()["umbral_retrasos"] == 5

    cambio = await client.put("/api/v1/dashboard/configuracion", headers=directiva, json={"umbral_retrasos": 3})
    assert cambio.status_code == 200
    assert cambio.json()["umbral_retrasos"] == 3
    assert cambio.json()["actualizado_por_nombre"] == "dir"
    assert (await client.get("/api/v1/dashboard/configuracion", headers=directiva)).json()["umbral_retrasos"] == 3

    traza = await get_db()["auditoria"].find_one({"accion": "dashboard.configuracion_put"})
    assert traza["detalle"] == {"antes": {"umbral_retrasos": 5}, "despues": {"umbral_retrasos": 3}}

    assert (await client.put("/api/v1/dashboard/configuracion", headers=directiva, json={"umbral_retrasos": 0})).status_code == 422
    assert (await client.put("/api/v1/dashboard/configuracion", headers=docente, json={"umbral_retrasos": 9})).status_code == 403
    assert (await client.get("/api/v1/dashboard/configuracion", headers=docente)).status_code == 403


@pytest.mark.asyncio
async def test_kpi_retrasos_por_grupo_y_umbral(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    db = get_db()
    res = await db["alumnos"].insert_many(
        [
            {"nombre": "Ana", "grupo": "1DAW", "curso": "1º DAW"},
            {"nombre": "Beto", "grupo": "1DAW", "curso": "1º DAW"},
            {"nombre": "Clara", "grupo": "2DAW", "curso": "2º DAW"},
        ]
    )
    ana, beto, clara = (str(i) for i in res.inserted_ids)

    def retraso(alumno: str, grupo: str, dia: int, modulo: str, curso: str = "2026/2027") -> dict[str, Any]:
        return {
            "alumno_id": alumno,
            "grupo": grupo,
            "fecha": f"2026-10-{dia:02d}",
            "hora": "08:10",
            "modulo": modulo,
            "curso_escolar": curso,
            "registrado_por_id": "u",
        }

    await db["retrasos"].insert_many(
        [
            retraso(ana, "1DAW", 1, "Programación"),
            retraso(ana, "1DAW", 2, "Programación"),
            retraso(ana, "1DAW", 3, "Bases de Datos"),
            retraso(beto, "1DAW", 1, "Programación"),
            retraso(clara, "2DAW", 1, "DWES"),
            retraso(clara, "2DAW", 2, "DWES"),
            retraso(clara, "2DAW", 3, "DWES", curso="2025/2026"),  # otro curso escolar: no cuenta
        ]
    )
    directiva = await _activate(client, monkeypatch, "dir@x.com", [Role.directiva])
    await client.put("/api/v1/dashboard/configuracion", headers=directiva, json={"umbral_retrasos": 2})

    res = await client.get("/api/v1/dashboard/retrasos", headers=directiva, params={"curso_escolar": "2026/2027"})
    assert res.status_code == 200
    body = res.json()
    assert (body["curso_escolar"], body["umbral"], body["total"]) == ("2026/2027", 2, 6)
    assert body["por_grupo"] == [
        {"grupo": "1DAW", "retrasos": 4, "alumnos_con_retrasos": 2, "alumnos_sobre_umbral": 1},
        {"grupo": "2DAW", "retrasos": 2, "alumnos_con_retrasos": 1, "alumnos_sobre_umbral": 1},
    ]
    assert body["por_modulo"][0] == {"modulo": "Programación", "retrasos": 3}
    assert body["alumnado_sobre_umbral"] == [
        {"alumno_id": ana, "nombre": "Ana", "grupo": "1DAW", "retrasos": 3},
        {"alumno_id": clara, "nombre": "Clara", "grupo": "2DAW", "retrasos": 2},
    ]

    # Subir el umbral recalcula quién lo supera, sin tocar los datos.
    await client.put("/api/v1/dashboard/configuracion", headers=directiva, json={"umbral_retrasos": 3})
    otra = (await client.get("/api/v1/dashboard/retrasos", headers=directiva, params={"curso_escolar": "2026/2027"})).json()
    assert [a["nombre"] for a in otra["alumnado_sobre_umbral"]] == ["Ana"]


@pytest.mark.asyncio
async def test_kpi_retrasos_no_visible_para_docente(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Las estadísticas de retrasos son exclusivas de dirección (memoria 5.3.2)."""
    docente = await _activate(client, monkeypatch, "doc@x.com", [Role.docente])
    assert (await client.get("/api/v1/dashboard/retrasos", headers=docente)).status_code == 403
