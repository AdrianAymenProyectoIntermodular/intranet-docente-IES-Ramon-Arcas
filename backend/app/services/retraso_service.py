"""Servicio de retrasos: el docente registra y consulta el histórico individual.

Las estadísticas agregadas NO se exponen aquí (solo Dashboard directivo).
"""

from datetime import UTC, date, datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.models.retraso import Retraso, RetrasoCreate, RetrasoPaginated, doc_to_retraso
from app.models.usuario import UsuarioPublic
from app.services import alumno_service, auditoria_service

COLLECTION = "retrasos"


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    # Duplicado mismo alumno/fecha/hora/módulo → 409.
    await db[COLLECTION].create_index(
        [("alumno_id", 1), ("fecha", 1), ("hora", 1), ("modulo", 1)],
        unique=True,
    )
    await db[COLLECTION].create_index([("alumno_id", 1), ("curso_escolar", 1), ("fecha", -1)])


def curso_escolar_de(fecha: date) -> str:
    """Curso escolar de septiembre a agosto: 2026-10-01 → '2026/2027'."""
    inicio = fecha.year if fecha.month >= 9 else fecha.year - 1
    return f"{inicio}/{inicio + 1}"


async def create_retraso(
    db: AsyncIOMotorDatabase,
    payload: RetrasoCreate,
    *,
    autor: UsuarioPublic,
) -> Retraso:
    if payload.fecha > date.today():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La fecha del retraso no puede ser futura",
        )
    alumno = await alumno_service.get_by_id(db, payload.alumno_id)
    if alumno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alumno no encontrado")

    doc: dict[str, Any] = {
        "alumno_id": alumno.id,
        "fecha": payload.fecha.isoformat(),
        "hora": payload.hora,
        "modulo": payload.modulo.strip(),
        "grupo": alumno.grupo or None,
        "curso_escolar": curso_escolar_de(payload.fecha),
        "registrado_por_id": autor.id,
        "creado_en": datetime.now(UTC),
    }
    try:
        result = await db[COLLECTION].insert_one(doc)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ese retraso ya está registrado",
        ) from exc
    doc["_id"] = result.inserted_id
    await auditoria_service.record_required(
        db,
        accion="retrasos.create",
        usuario_id=autor.id,
        usuario_nombre=autor.name,
        recurso_tipo="retraso",
        recurso_id=str(result.inserted_id),
        detalle={"alumno_id": alumno.id, "fecha": doc["fecha"], "modulo": doc["modulo"]},
    )
    return doc_to_retraso(doc)


async def get_retraso(db: AsyncIOMotorDatabase, retraso_id: str) -> Retraso:
    if not ObjectId.is_valid(retraso_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retraso no encontrado")
    doc = await db[COLLECTION].find_one({"_id": ObjectId(retraso_id)})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Retraso no encontrado")
    return doc_to_retraso(doc)


async def list_por_alumno(
    db: AsyncIOMotorDatabase,
    alumno_id: str,
    *,
    lector: UsuarioPublic,
    curso_escolar: str | None,
    page: int,
    limit: int,
) -> RetrasoPaginated:
    """Histórico individual. Cada consulta se audita (datos de menores)."""
    alumno = await alumno_service.get_by_id(db, alumno_id)
    if alumno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alumno no encontrado")

    query: dict[str, Any] = {"alumno_id": alumno.id}
    if curso_escolar:
        query["curso_escolar"] = curso_escolar

    await auditoria_service.record_required(
        db,
        accion="retrasos.consulta_historico",
        usuario_id=lector.id,
        usuario_nombre=lector.name,
        recurso_tipo="alumno",
        recurso_id=alumno.id,
        detalle={"curso_escolar": curso_escolar} if curso_escolar else None,
    )

    skip = (page - 1) * limit
    total = await db[COLLECTION].count_documents(query)
    cursor = (
        db[COLLECTION].find(query).sort([("fecha", -1), ("hora", -1)]).skip(skip).limit(limit)
    )
    items = [doc_to_retraso(doc) async for doc in cursor]
    return RetrasoPaginated(items=items, page=page, limit=limit, total=total)
