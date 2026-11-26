"""Servicio de emplazamientos: validación de la rejilla y del alumnado del grupo."""

from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.emplazamiento import Emplazamiento, EmplazamientoCreate, doc_to_emplazamiento
from app.models.usuario import UsuarioPublic, utcnow
from app.services.nombres import con_nombre, con_nombres

COLLECTION = "emplazamientos"
NOMBRES = {"autor_id": "autor_nombre"}


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db[COLLECTION].create_index([("grupo", 1), ("modulo", 1), ("actualizado_en", -1)])


def _422(detalle: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=detalle)


async def validar(db: AsyncIOMotorDatabase, payload: EmplazamientoCreate) -> None:
    if await db["alumnos"].count_documents({"grupo": payload.grupo}, limit=1) == 0:
        raise _422(f"El grupo {payload.grupo} no existe")

    posiciones: set[tuple[int, int]] = set()
    alumnos: list[str] = []
    for p in payload.puestos:
        if p.fila >= payload.filas or p.columna >= payload.columnas:
            raise _422(f"El puesto ({p.fila}, {p.columna}) está fuera de la rejilla")
        if (p.fila, p.columna) in posiciones:
            raise _422(f"Hay dos puestos en la posición ({p.fila}, {p.columna})")
        posiciones.add((p.fila, p.columna))
        if p.alumno_id:
            if p.alumno_id in alumnos:
                raise _422("Un alumno no puede ocupar dos puestos")
            alumnos.append(p.alumno_id)

    if alumnos:
        oids = [ObjectId(a) for a in alumnos if ObjectId.is_valid(a)]
        del_grupo = await db["alumnos"].count_documents({"_id": {"$in": oids}, "grupo": payload.grupo})
        if len(oids) != len(alumnos) or del_grupo != len(alumnos):
            raise _422(f"Todos los alumnos deben pertenecer al grupo {payload.grupo}")


def _oid(emplazamiento_id: str) -> ObjectId:
    if not ObjectId.is_valid(emplazamiento_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emplazamiento no encontrado")
    return ObjectId(emplazamiento_id)


async def obtener(db: AsyncIOMotorDatabase, emplazamiento_id: str) -> Emplazamiento:
    doc = await db[COLLECTION].find_one({"_id": _oid(emplazamiento_id)})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Emplazamiento no encontrado")
    return await con_nombre(db, doc_to_emplazamiento(doc), NOMBRES)


async def listar(db: AsyncIOMotorDatabase, *, grupo: str | None, modulo: str | None) -> list[Emplazamiento]:
    query: dict[str, Any] = {}
    if grupo:
        query["grupo"] = grupo
    if modulo:
        query["modulo"] = modulo
    cursor = db[COLLECTION].find(query).sort("actualizado_en", -1).limit(100)
    return await con_nombres(db, [doc_to_emplazamiento(d) async for d in cursor], NOMBRES)


async def crear(db: AsyncIOMotorDatabase, payload: EmplazamientoCreate, *, autor: UsuarioPublic) -> Emplazamiento:
    await validar(db, payload)
    ahora = utcnow()
    doc = {**payload.model_dump(mode="json"), "autor_id": autor.id, "creado_en": ahora, "actualizado_en": ahora}
    result = await db[COLLECTION].insert_one(doc)
    return await obtener(db, str(result.inserted_id))


def comprobar_autor(emplazamiento: Emplazamiento, usuario: UsuarioPublic) -> None:
    if "admin" not in usuario.roles and emplazamiento.autor_id != usuario.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo quien creó el diseño o administración pueden modificarlo",
        )


async def reemplazar(
    db: AsyncIOMotorDatabase, emplazamiento_id: str, payload: EmplazamientoCreate, *, usuario: UsuarioPublic
) -> Emplazamiento:
    actual = await obtener(db, emplazamiento_id)
    comprobar_autor(actual, usuario)
    await validar(db, payload)
    await db[COLLECTION].update_one(
        {"_id": _oid(emplazamiento_id)},
        {"$set": {**payload.model_dump(mode="json"), "actualizado_en": utcnow()}},
    )
    return await obtener(db, emplazamiento_id)


async def borrar(db: AsyncIOMotorDatabase, emplazamiento_id: str, *, usuario: UsuarioPublic) -> None:
    actual = await obtener(db, emplazamiento_id)
    comprobar_autor(actual, usuario)
    await db[COLLECTION].delete_one({"_id": _oid(emplazamiento_id)})
