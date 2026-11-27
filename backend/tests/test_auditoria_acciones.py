"""Cada mutación relevante deja traza en auditoría (memoria 5.9.1). Requiere Mongo + Redis."""

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
from app.services import auth_service, geocodificacion, usuario_service

COLECCIONES = (
    "usuarios",
    "auditoria",
    "anuncios",
    "tickets",
    "ticket_comentarios",
    "alumnos",
    "emplazamientos",
    "fem_alumnos",
    "fem_empresas",
)


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[AsyncClient]:
    async def _geo(_direccion: str, _municipio: str) -> tuple[float, float] | None:
        return (37.67, -1.70)

    monkeypatch.setattr(geocodificacion, "geocodificar", _geo)
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


async def _activate(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
    email: str,
    roles: list[Role],
    competencias: list[str] | None = None,
) -> tuple[dict[str, str], str]:
    claims = {"email": email, "sub": f"g-{email}", "name": email.split("@")[0], "email_verified": True}
    monkeypatch.setattr(auth_service, "verify_google_id_token", lambda _t: claims)
    login = await client.post("/api/v1/auth/google", json={"id_token": "x"})
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    uid = me.json()["id"]
    await usuario_service.patch_usuario(
        get_db(), uid, UsuarioPatch(roles=roles, estado=UsuarioEstado.activo, competencias=competencias or [])
    )
    login2 = await client.post("/api/v1/auth/google", json={"id_token": "x"})
    return {"Authorization": f"Bearer {login2.json()['access_token']}"}, uid


async def _traza(accion: str, recurso_id: str) -> dict[str, Any]:
    doc = await get_db()["auditoria"].find_one({"accion": accion, "recurso_id": recurso_id})
    assert doc is not None, f"falta la traza {accion} de {recurso_id}"
    return doc


@pytest.mark.asyncio
async def test_anuncios(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    admin, admin_id = await _activate(client, monkeypatch, "admin@x.com", [Role.admin])
    creado = (await client.post("/api/v1/anuncios", headers=admin, json={"titulo": "Claustro", "cuerpo": "Martes"})).json()

    traza = await _traza("anuncios.create", creado["id"])
    assert traza["usuario_id"] == admin_id
    assert traza["detalle"]["titulo"] == "Claustro"

    await client.patch(f"/api/v1/anuncios/{creado['id']}/fijar", headers=admin, json={"fijado": True})
    assert (await _traza("anuncios.fijar", creado["id"]))["detalle"] == {"fijado": True}


@pytest.mark.asyncio
async def test_tickets(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    rmi, rmi_id = await _activate(client, monkeypatch, "rmi@x.com", [Role.responsable_ticket], ["rmi"])
    doc, doc_id = await _activate(client, monkeypatch, "doc@x.com", [Role.docente])

    ticket = (
        await client.post(
            "/api/v1/tickets",
            headers=doc,
            json={"tipo": "rmi", "titulo": "Proyector", "datos": {"aula": "A1", "dispositivos": "Proyector"}},
        )
    ).json()
    creado = await _traza("tickets.create", ticket["id"])
    assert creado["usuario_id"] == doc_id
    assert creado["detalle"]["tipo"] == "rmi"

    await client.patch(f"/api/v1/tickets/{ticket['id']}", headers=rmi, json={"estado": "en_proceso"})
    cambio = await _traza("tickets.patch", ticket["id"])
    assert cambio["usuario_id"] == rmi_id
    assert cambio["detalle"]["antes"]["estado"] == "abierto"
    assert cambio["detalle"]["despues"]["estado"] == "en_proceso"

    comentario = (await client.post(f"/api/v1/tickets/{ticket['id']}/comentarios", headers=doc, json={"cuerpo": "Gracias"})).json()
    assert (await _traza("tickets.comentario_create", ticket["id"]))["detalle"]["comentario_id"] == comentario["id"]


@pytest.mark.asyncio
async def test_borrador_rrss(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc, _ = await _activate(client, monkeypatch, "doc@x.com", [Role.docente])
    ticket = (
        await client.post(
            "/api/v1/tickets",
            headers=doc,
            json={"tipo": "rrss", "titulo": "Feria", "descripcion": "Visita", "datos": {"departamento": "Informática"}},
        )
    ).json()
    assert (await client.post(f"/api/v1/tickets/{ticket['id']}/borrador", headers=doc)).status_code == 200
    await _traza("tickets.borrador_regenerar", ticket["id"])


@pytest.mark.asyncio
async def test_emplazamientos(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc, _ = await _activate(client, monkeypatch, "d@x.com", [Role.docente])
    res = await get_db()["alumnos"].insert_many([{"nombre": f"A{i}", "grupo": "1ESO-A", "curso": "1º ESO"} for i in range(2)])
    alumnos = [str(i) for i in res.inserted_ids]
    diseno = {
        "nombre": "Parejas",
        "grupo": "1ESO-A",
        "modulo": "Matemáticas",
        "distribucion": "parejas",
        "filas": 1,
        "columnas": 2,
        "puestos": [{"fila": 0, "columna": i, "alumno_id": a} for i, a in enumerate(alumnos)],
    }
    creado = (await client.post("/api/v1/emplazamientos", headers=doc, json=diseno)).json()
    assert (await _traza("emplazamientos.create", creado["id"]))["detalle"]["grupo"] == "1ESO-A"

    await client.put(f"/api/v1/emplazamientos/{creado['id']}", headers=doc, json={**diseno, "nombre": "Filas"})
    assert (await _traza("emplazamientos.update", creado["id"]))["detalle"]["nombre"] == "Filas"

    await client.delete(f"/api/v1/emplazamientos/{creado['id']}", headers=doc)
    assert (await _traza("emplazamientos.delete", creado["id"]))["detalle"]["nombre"] == "Filas"


@pytest.mark.asyncio
async def test_fem(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    admin, _ = await _activate(client, monkeypatch, "admin@x.com", [Role.admin])
    alumno = await get_db()["fem_alumnos"].insert_one({"nombre": "Lucía", "horas_cursadas": 100, "horas_totales": 500})
    alumno_id = str(alumno.inserted_id)

    await client.patch(f"/api/v1/fem/alumnos/{alumno_id}/horas", headers=admin, json={"horas_cursadas": 120})
    horas = await _traza("fem.horas_patch", alumno_id)
    assert horas["detalle"] == {"antes": 100, "despues": 120}

    empresa = (
        await client.post(
            "/api/v1/fem/empresas",
            headers=admin,
            json={"nombre": "Acme", "direccion": "Calle Mayor 1", "municipio": "Lorca"},
        )
    ).json()
    await client.post(f"/api/v1/fem/empresas/{empresa['id']}/geocodificar", headers=admin)
    assert (await _traza("fem.empresa_geocodificar", empresa["id"]))["detalle"]["geocodificada"] is True
