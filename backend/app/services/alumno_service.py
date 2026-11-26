"""Servicio de alumnado (lectura acotada para selectores de la PWA)."""

import re
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.alumno import Alumno, doc_to_alumno

COLLECTION = "alumnos"
MAX_RESULTADOS = 50


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db[COLLECTION].create_index([("grupo", 1), ("nombre", 1)])


async def get_by_id(db: AsyncIOMotorDatabase, alumno_id: str) -> Alumno | None:
    if not ObjectId.is_valid(alumno_id):
        return None
    doc = await db[COLLECTION].find_one({"_id": ObjectId(alumno_id)})
    return doc_to_alumno(doc) if doc else None


async def list_alumnos(
    db: AsyncIOMotorDatabase,
    *,
    grupo: str | None,
    q: str | None,
) -> list[Alumno]:
    """Búsqueda acotada (máx. 50) por grupo y/o fragmento de nombre."""
    query: dict[str, Any] = {}
    if grupo:
        query["grupo"] = grupo
    if q and q.strip():
        query["nombre"] = {"$regex": re.escape(q.strip()), "$options": "i"}
    cursor = db[COLLECTION].find(query).sort([("grupo", 1), ("nombre", 1)]).limit(MAX_RESULTADOS)
    return [doc_to_alumno(doc) async for doc in cursor]
