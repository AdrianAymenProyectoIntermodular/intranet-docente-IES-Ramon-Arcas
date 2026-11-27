"""Resolución de nombres del personal para mostrar en lugar de identificadores.

Solo expone el nombre de cuentas del claustro (dato no sensible) y lo hace con una
única consulta `$in` por respuesta.
"""

from collections.abc import Iterable, Sequence
from typing import TypeVar

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

M = TypeVar("M", bound=BaseModel)


async def nombres_de(db: AsyncIOMotorDatabase, ids: Iterable[str | None]) -> dict[str, str]:
    oids = {ObjectId(i) for i in ids if i and ObjectId.is_valid(i)}
    if not oids:
        return {}
    cursor = db["usuarios"].find({"_id": {"$in": list(oids)}}, {"name": 1})
    return {str(doc["_id"]): doc["name"] async for doc in cursor}


async def con_nombres(
    db: AsyncIOMotorDatabase,
    objetos: Sequence[M],
    campos: dict[str, str],
) -> list[M]:
    """
    Devuelve copias de `objetos` con los campos de nombre rellenos.
    `campos` mapea el atributo con el id al atributo del nombre, p. ej.
    {"solicitante_id": "solicitante_nombre"}.
    """
    ids = [getattr(o, campo_id) for o in objetos for campo_id in campos]
    nombres = await nombres_de(db, ids)
    return [
        o.model_copy(update={nombre: nombres.get(getattr(o, campo_id) or "") for campo_id, nombre in campos.items()})
        for o in objetos
    ]


async def con_nombre(db: AsyncIOMotorDatabase, objeto: M, campos: dict[str, str]) -> M:
    return (await con_nombres(db, [objeto], campos))[0]
