"""Borrador de publicaciones RRSS con proveedor intercambiable (plantilla temporal)."""

import os
import re
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
from app.services import auth_service, ia, usuario_service
from app.services.ia import Borrador, EntradaBorrador, ErrorGeneracion
from app.services.ia.plantilla import GeneradorPlantilla, hashtag


@pytest_asyncio.fixture
async def ctx(monkeypatch: pytest.MonkeyPatch) -> AsyncIterator[tuple[AsyncClient, dict[str, str]]]:
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
            login = await client.post("/api/v1/auth/google", json={"id_token": "x"})
            me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
            await usuario_service.patch_usuario(db, me.json()["id"], UsuarioPatch(roles=[Role.docente], estado=UsuarioEstado.activo))
            login2 = await client.post("/api/v1/auth/google", json={"id_token": "x"})
            yield client, {"Authorization": f"Bearer {login2.json()['access_token']}"}


RRSS = {
    "tipo": "rrss",
    "titulo": "Publicación: Semana de la Ciencia",
    "descripcion": "Talleres de química para 2º ESO en el laboratorio.",
    "datos": {"departamento": "Física y Química"},
}


def test_hashtag() -> None:
    assert hashtag("Física y Química") == "#FisicaYQuimica"
    assert hashtag("") == ""


@pytest.mark.asyncio
async def test_plantilla_no_inventa() -> None:
    """Todas las palabras del borrador salen de la entrada o del pie fijo del centro."""
    entrada = EntradaBorrador(titulo="Feria de empleo", departamento="Informática", descripcion="Visita de empresas locales.")
    borrador = await GeneradorPlantilla().generar(entrada)
    permitidas = set(re.findall(r"\w+", f"{entrada.titulo} {entrada.descripcion} {entrada.departamento}".lower()))
    permitidas |= set(re.findall(r"\w+", "una actividad del departamento de del ies ramón arcas meca iesramonarcas lorca informatica"))
    assert set(re.findall(r"\w+", borrador.texto.lower())) <= permitidas
    assert borrador.proveedor == "plantilla"


@pytest.mark.asyncio
async def test_borrador_al_crear(ctx: tuple[AsyncClient, dict[str, str]]) -> None:
    client, h = ctx
    creado = await client.post("/api/v1/tickets", headers=h, json=RRSS)
    assert creado.status_code == 201
    assert creado.json()["borrador"]["estado"] == "pendiente"

    # La tarea en segundo plano ya se ha ejecutado al terminar la petición.
    listado = (await client.get("/api/v1/tickets?tipo=rrss", headers=h)).json()
    borrador = listado[0]["borrador"]
    assert borrador["estado"] == "listo"
    assert borrador["proveedor"] == "plantilla"
    assert borrador["texto"].startswith("Semana de la Ciencia")
    assert "Talleres de química" in borrador["texto"]
    assert "#FisicaYQuimica" in borrador["texto"]


@pytest.mark.asyncio
async def test_regenerar_y_errores(ctx: tuple[AsyncClient, dict[str, str]], monkeypatch: pytest.MonkeyPatch) -> None:
    client, h = ctx
    tid = (await client.post("/api/v1/tickets", headers=h, json=RRSS)).json()["id"]

    class Fallido:
        nombre = "fallido"

        async def generar(self, entrada: EntradaBorrador) -> Borrador:
            raise ErrorGeneracion("Proveedor no disponible")

    monkeypatch.setitem(ia.PROVEEDORES, "fallido", Fallido)
    monkeypatch.setattr(get_settings(), "ia_proveedor", "fallido")
    res = await client.post(f"/api/v1/tickets/{tid}/borrador", headers=h)
    assert res.status_code == 200
    assert res.json()["borrador"] == {**res.json()["borrador"], "estado": "error", "error": "Proveedor no disponible"}

    monkeypatch.setattr(get_settings(), "ia_proveedor", "plantilla")
    res = await client.post(f"/api/v1/tickets/{tid}/borrador", headers=h)
    assert res.json()["borrador"]["estado"] == "listo"

    otro = await client.post(
        "/api/v1/tickets", headers=h, json={"tipo": "otro", "titulo": "Consulta"}
    )
    assert otro.json()["borrador"] is None
    no_rrss = await client.post(f"/api/v1/tickets/{otro.json()['id']}/borrador", headers=h)
    assert no_rrss.status_code == 422
