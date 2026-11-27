"""Servicio de anuncios del tablón."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.anuncio import Anuncio, AnuncioCreate, doc_to_anuncio
from app.services.nombres import con_nombre, con_nombres

COLLECTION = "anuncios"
NOMBRES = {"autor_id": "autor_nombre"}


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db[COLLECTION].create_index([("fijado", -1), ("creado_en", -1)])
    await db[COLLECTION].create_index("departamento")
    await db[COLLECTION].create_index("curso")


def _oid(resource_id: str) -> ObjectId:
    if not ObjectId.is_valid(resource_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anuncio no encontrado")
    return ObjectId(resource_id)


async def list_anuncios(
    db: AsyncIOMotorDatabase,
    *,
    departamento: str | None,
    viewer_departamento: str,
    curso: str | None = None,
) -> list[Anuncio]:
    """Feed: anuncios generales + del departamento del viewer (o filtro explícito), opcionalmente de un curso."""
    now = datetime.now(UTC)
    not_expired: dict[str, Any] = {
        "$or": [{"expira_en": None}, {"expira_en": {"$gt": now}}],
    }
    if departamento:
        dept_filter: dict[str, Any] = {"departamento": departamento}
    else:
        dept_filter = {
            "$or": [
                {"departamento": None},
                {"departamento": ""},
                {"departamento": viewer_departamento},
            ]
        }
    condiciones: list[dict[str, Any]] = [not_expired, dept_filter]
    if curso:
        condiciones.append({"curso": curso})
    query: dict[str, Any] = {"$and": condiciones}

    cursor = db[COLLECTION].find(query).sort([("fijado", -1), ("creado_en", -1)])
    return await con_nombres(db, [doc_to_anuncio(doc) async for doc in cursor], NOMBRES)


async def create_anuncio(
    db: AsyncIOMotorDatabase,
    payload: AnuncioCreate,
    *,
    autor_id: str,
) -> Anuncio:
    doc = {
        "titulo": payload.titulo,
        "cuerpo": payload.cuerpo,
        "departamento": payload.departamento,
        "curso": (payload.curso or "").strip() or None,
        "expira_en": payload.expira_en,
        "fijado": False,
        "autor_id": autor_id,
        "creado_en": datetime.now(UTC),
    }
    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    return await con_nombre(db, doc_to_anuncio(doc), NOMBRES)


async def fijar_anuncio(db: AsyncIOMotorDatabase, anuncio_id: str, fijado: bool) -> Anuncio:
    result = await db[COLLECTION].find_one_and_update(
        {"_id": _oid(anuncio_id)},
        {"$set": {"fijado": fijado}},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anuncio no encontrado")
    return await con_nombre(db, doc_to_anuncio(result), NOMBRES)
