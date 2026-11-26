"""Empresas colaboradoras de la FEM (con ubicación para el mapa)."""

from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.fem import Empresa, EmpresaCreate, EmpresaPatch, doc_to_empresa
from app.models.usuario import utcnow
from app.services import geocodificacion

COLLECTION = "fem_empresas"


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db[COLLECTION].create_index("municipio")
    await db[COLLECTION].create_index("ciclos")


def _oid(empresa_id: str) -> ObjectId:
    if not ObjectId.is_valid(empresa_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")
    return ObjectId(empresa_id)


async def _alumnos_por_empresa(db: AsyncIOMotorDatabase, ids: list[str]) -> dict[str, int]:
    pipeline = [
        {"$match": {"empresa_id": {"$in": ids}, "estado": "activo"}},
        {"$group": {"_id": "$empresa_id", "n": {"$sum": 1}}},
    ]
    return {row["_id"]: row["n"] async for row in db["fem_alumnos"].aggregate(pipeline)}


async def listar(
    db: AsyncIOMotorDatabase,
    *,
    municipio: str | None = None,
    ciclo: str | None = None,
    activa: bool | None = None,
) -> list[Empresa]:
    query: dict[str, Any] = {}
    if municipio:
        query["municipio"] = municipio
    if ciclo:
        query["ciclos"] = ciclo
    if activa is not None:
        query["activa"] = activa
    docs = [d async for d in db[COLLECTION].find(query).sort("nombre", 1)]
    conteo = await _alumnos_por_empresa(db, [str(d["_id"]) for d in docs])
    return [doc_to_empresa(d, conteo.get(str(d["_id"]), 0)) for d in docs]


async def obtener(db: AsyncIOMotorDatabase, empresa_id: str) -> Empresa:
    doc = await db[COLLECTION].find_one({"_id": _oid(empresa_id)})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Empresa no encontrada")
    conteo = await _alumnos_por_empresa(db, [empresa_id])
    return doc_to_empresa(doc, conteo.get(empresa_id, 0))


async def _coordenadas(direccion: str, municipio: str) -> dict[str, Any]:
    punto = await geocodificacion.geocodificar(direccion, municipio)
    if punto is None:
        return {"lat": None, "lon": None, "geocodificado_en": None}
    return {"lat": punto[0], "lon": punto[1], "geocodificado_en": utcnow()}


async def crear(db: AsyncIOMotorDatabase, payload: EmpresaCreate) -> Empresa:
    doc = {
        **payload.model_dump(),
        **await _coordenadas(payload.direccion, payload.municipio),
        "creado_en": utcnow(),
    }
    result = await db[COLLECTION].insert_one(doc)
    return await obtener(db, str(result.inserted_id))


async def actualizar(db: AsyncIOMotorDatabase, empresa_id: str, payload: EmpresaPatch) -> Empresa:
    actual = await obtener(db, empresa_id)
    cambios = payload.model_dump(exclude_unset=True, exclude_none=True)
    direccion = cambios.get("direccion", actual.direccion)
    municipio = cambios.get("municipio", actual.municipio)
    if direccion != actual.direccion or municipio != actual.municipio:
        cambios |= await _coordenadas(direccion, municipio)
    if "nombre" in cambios:
        # El listado de alumnado muestra el nombre de la empresa.
        await db["fem_alumnos"].update_many({"empresa_id": empresa_id}, {"$set": {"empresa": cambios["nombre"]}})
    if cambios:
        cambios["actualizado_en"] = utcnow()
        await db[COLLECTION].update_one({"_id": _oid(empresa_id)}, {"$set": cambios})
    return await obtener(db, empresa_id)


async def reintentar_geocodificacion(db: AsyncIOMotorDatabase, empresa_id: str) -> Empresa:
    actual = await obtener(db, empresa_id)
    coordenadas = await _coordenadas(actual.direccion, actual.municipio)
    if coordenadas["lat"] is None:
        # Si no se encuentra, se conservan las coordenadas que hubiera.
        return actual
    await db[COLLECTION].update_one({"_id": _oid(empresa_id)}, {"$set": coordenadas})
    return await obtener(db, empresa_id)
