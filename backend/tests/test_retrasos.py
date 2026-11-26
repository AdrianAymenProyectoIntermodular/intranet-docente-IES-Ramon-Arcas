"""Tests de alumnado y retrasos (requieren Mongo + Redis)."""

import os
from collections.abc import AsyncIterator
from datetime import date, timedelta

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
from app.services.retraso_service import curso_escolar_de


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            db = get_db()
            for col in ("usuarios", "auditoria", "alumnos", "retrasos"):
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
    sub: str,
    roles: list[Role],
) -> dict[str, str]:
    claims = {"email": email, "sub": sub, "name": email.split("@")[0], "email_verified": True}
    monkeypatch.setattr(auth_service, "verify_google_id_token", lambda _t: claims)
    login = await client.post("/api/v1/auth/google", json={"id_token": f"fake-{sub}"})
    access = login.json()["access_token"]
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    await usuario_service.patch_usuario(
        get_db(), me.json()["id"], UsuarioPatch(roles=roles, estado=UsuarioEstado.activo)
    )
    login2 = await client.post("/api/v1/auth/google", json={"id_token": f"fake-{sub}"})
    return {"Authorization": f"Bearer {login2.json()['access_token']}"}


async def _alumno(nombre: str = "Alumno Prueba", grupo: str = "1ESO-A") -> str:
    result = await get_db()["alumnos"].insert_one({"nombre": nombre, "grupo": grupo, "curso": "1º ESO"})
    return str(result.inserted_id)


def test_curso_escolar() -> None:
    assert curso_escolar_de(date(2026, 10, 1)) == "2026/2027"
    assert curso_escolar_de(date(2027, 3, 15)) == "2026/2027"
    assert curso_escolar_de(date(2027, 9, 1)) == "2027/2028"


@pytest.mark.asyncio
async def test_listado_alumnos_filtra_y_requiere_rol(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    await _alumno("Lucía Prueba", "1ESO-A")
    await _alumno("Mario Ensayo", "2ESO-B")

    tutor = await _activate_as(client, monkeypatch, email="t@example.com", sub="g-t", roles=[Role.tutor])
    assert (await client.get("/api/v1/alumnos", headers=tutor)).status_code == 403

    doc = await _activate_as(client, monkeypatch, email="d@example.com", sub="g-d", roles=[Role.docente])
    res = await client.get("/api/v1/alumnos", headers=doc)
    assert res.status_code == 200
    assert len(res.json()) == 2

    res = await client.get("/api/v1/alumnos", params={"q": "lucía"}, headers=doc)
    assert [a["nombre"] for a in res.json()] == ["Lucía Prueba"]

    res = await client.get("/api/v1/alumnos", params={"grupo": "2ESO-B"}, headers=doc)
    assert [a["grupo"] for a in res.json()] == ["2ESO-B"]


@pytest.mark.asyncio
async def test_registro_retraso_y_errores(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc = await _activate_as(client, monkeypatch, email="d@example.com", sub="g-d", roles=[Role.docente])
    alumno_id = await _alumno()
    hoy = date.today().isoformat()
    body = {"alumno_id": alumno_id, "fecha": hoy, "hora": "08:20", "modulo": "Matemáticas"}

    res = await client.post("/api/v1/retrasos", json=body, headers=doc)
    assert res.status_code == 201
    creado = res.json()
    assert res.headers["Location"] == f"/api/v1/retrasos/{creado['id']}"
    assert creado["grupo"] == "1ESO-A"
    assert creado["curso_escolar"] == curso_escolar_de(date.today())
    me = await client.get("/api/v1/auth/me", headers=doc)
    assert creado["registrado_por_id"] == me.json()["id"]

    # Detalle
    detalle = await client.get(f"/api/v1/retrasos/{creado['id']}", headers=doc)
    assert detalle.status_code == 200

    # Duplicado → 409
    assert (await client.post("/api/v1/retrasos", json=body, headers=doc)).status_code == 409

    # Fecha futura → 422
    futuro = {**body, "fecha": (date.today() + timedelta(days=1)).isoformat()}
    assert (await client.post("/api/v1/retrasos", json=futuro, headers=doc)).status_code == 422

    # Hora mal formada → 422
    mala_hora = {**body, "hora": "8:20"}
    assert (await client.post("/api/v1/retrasos", json=mala_hora, headers=doc)).status_code == 422

    # El autor no puede venir en el cuerpo → 422
    con_autor = {**body, "registrado_por_id": "otro"}
    assert (await client.post("/api/v1/retrasos", json=con_autor, headers=doc)).status_code == 422

    # Alumno inexistente → 404
    inexistente = {**body, "alumno_id": "64b000000000000000000000"}
    assert (await client.post("/api/v1/retrasos", json=inexistente, headers=doc)).status_code == 404


@pytest.mark.asyncio
async def test_retrasos_prohibido_sin_rol(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    jef = await _activate_as(client, monkeypatch, email="j@example.com", sub="g-j", roles=[Role.jefatura])
    alumno_id = await _alumno()
    body = {"alumno_id": alumno_id, "fecha": date.today().isoformat(), "hora": "08:20", "modulo": "Lengua"}
    assert (await client.post("/api/v1/retrasos", json=body, headers=jef)).status_code == 403
    assert (await client.get(f"/api/v1/alumnos/{alumno_id}/retrasos", headers=jef)).status_code == 403


@pytest.mark.asyncio
async def test_historico_paginado_y_auditado(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc = await _activate_as(client, monkeypatch, email="d@example.com", sub="g-d", roles=[Role.docente])
    alumno_id = await _alumno()
    hoy = date.today()
    for i in range(3):
        body = {
            "alumno_id": alumno_id,
            "fecha": (hoy - timedelta(days=i)).isoformat(),
            "hora": "08:15",
            "modulo": "Historia",
        }
        assert (await client.post("/api/v1/retrasos", json=body, headers=doc)).status_code == 201

    res = await client.get(
        f"/api/v1/alumnos/{alumno_id}/retrasos", params={"page": 1, "limit": 2}, headers=doc
    )
    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 3
    assert page["limit"] == 2
    assert len(page["items"]) == 2
    # Orden: más recientes primero.
    assert page["items"][0]["fecha"] == hoy.isoformat()

    otro_curso = await client.get(
        f"/api/v1/alumnos/{alumno_id}/retrasos", params={"curso_escolar": "1999/2000"}, headers=doc
    )
    assert otro_curso.json()["total"] == 0

    consultas = await get_db()["auditoria"].count_documents(
        {"accion": "retrasos.consulta_historico", "recurso_id": alumno_id}
    )
    assert consultas == 2
    altas = await get_db()["auditoria"].count_documents({"accion": "retrasos.create"})
    assert altas == 3

    missing = await client.get("/api/v1/alumnos/64b000000000000000000000/retrasos", headers=doc)
    assert missing.status_code == 404
