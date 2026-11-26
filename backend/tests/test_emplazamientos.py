"""Emplazamiento del alumnado en el aula."""

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
            for col in ("usuarios", "auditoria", "alumnos", "emplazamientos"):
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


async def _alumnos() -> tuple[list[str], str]:
    res = await get_db()["alumnos"].insert_many(
        [{"nombre": f"A{i}", "grupo": "1ESO-A", "curso": "1º ESO"} for i in range(3)]
        + [{"nombre": "Otro", "grupo": "2ESO-B", "curso": "2º ESO"}]
    )
    ids = [str(i) for i in res.inserted_ids]
    return ids[:3], ids[3]


def _diseno(alumnos: list[str], **extra) -> dict:
    return {
        "nombre": "Parejas lunes",
        "grupo": "1ESO-A",
        "modulo": "Matemáticas",
        "distribucion": "parejas",
        "filas": 2,
        "columnas": 3,
        "puestos": [
            {"fila": 0, "columna": 0, "alumno_id": alumnos[0], "equipo": "A"},
            {"fila": 0, "columna": 1, "alumno_id": alumnos[1], "equipo": "A"},
            {"fila": 1, "columna": 0, "alumno_id": None},
        ],
        **extra,
    }


@pytest.mark.asyncio
async def test_crud(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    doc = await _activate(client, monkeypatch, "d@x.com", [Role.docente])
    alumnos, _ = await _alumnos()

    creado = await client.post("/api/v1/emplazamientos", headers=doc, json=_diseno(alumnos))
    assert creado.status_code == 201
    body = creado.json()
    assert creado.headers["Location"] == f"/api/v1/emplazamientos/{body['id']}"
    assert body["autor_nombre"] == "d"
    assert len(body["puestos"]) == 3

    listado = await client.get("/api/v1/emplazamientos", params={"grupo": "1ESO-A", "modulo": "Matemáticas"}, headers=doc)
    assert [e["id"] for e in listado.json()] == [body["id"]]
    assert (await client.get("/api/v1/emplazamientos", params={"grupo": "2ESO-B"}, headers=doc)).json() == []

    cambio = _diseno(alumnos, nombre="Filas", distribucion="filas")
    cambio["puestos"][2]["alumno_id"] = alumnos[2]
    put = await client.put(f"/api/v1/emplazamientos/{body['id']}", headers=doc, json=cambio)
    assert put.status_code == 200
    assert put.json()["nombre"] == "Filas"
    assert put.json()["puestos"][2]["alumno_id"] == alumnos[2]

    assert (await client.delete(f"/api/v1/emplazamientos/{body['id']}", headers=doc)).status_code == 204
    assert (await client.get(f"/api/v1/emplazamientos/{body['id']}", headers=doc)).status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mutar",
    [
        lambda d, otro: d["puestos"].append({"fila": 5, "columna": 0}),  # fuera de la rejilla
        lambda d, otro: d["puestos"].append({"fila": 0, "columna": 0}),  # posición duplicada
        lambda d, otro: d["puestos"].append({"fila": 1, "columna": 1, "alumno_id": d["puestos"][0]["alumno_id"]}),
        lambda d, otro: d["puestos"].append({"fila": 1, "columna": 2, "alumno_id": otro}),  # de otro grupo
        lambda d, otro: d.update(grupo="9Z"),  # grupo inexistente
        lambda d, otro: d.update(filas=11),
        lambda d, otro: d.update(distribucion="circulo"),
    ],
)
async def test_validaciones(client: AsyncClient, monkeypatch: pytest.MonkeyPatch, mutar) -> None:
    doc = await _activate(client, monkeypatch, "d@x.com", [Role.docente])
    alumnos, otro = await _alumnos()
    diseno = _diseno(alumnos)
    mutar(diseno, otro)
    assert (await client.post("/api/v1/emplazamientos", headers=doc, json=diseno)).status_code == 422


@pytest.mark.asyncio
async def test_permisos(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    autor = await _activate(client, monkeypatch, "a@x.com", [Role.docente])
    otro = await _activate(client, monkeypatch, "o@x.com", [Role.docente])
    admin = await _activate(client, monkeypatch, "adm@x.com", [Role.admin])
    tutor = await _activate(client, monkeypatch, "t@x.com", [Role.tutor])
    alumnos, _ = await _alumnos()
    eid = (await client.post("/api/v1/emplazamientos", headers=autor, json=_diseno(alumnos))).json()["id"]

    assert (await client.get("/api/v1/emplazamientos", headers=tutor)).status_code == 403
    assert (await client.get(f"/api/v1/emplazamientos/{eid}", headers=otro)).status_code == 200
    assert (await client.put(f"/api/v1/emplazamientos/{eid}", headers=otro, json=_diseno(alumnos))).status_code == 403
    assert (await client.delete(f"/api/v1/emplazamientos/{eid}", headers=otro)).status_code == 403
    assert (await client.delete(f"/api/v1/emplazamientos/{eid}", headers=admin)).status_code == 204
