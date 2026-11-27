"""Servicio de tickets y comentarios."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.usuario import UsuarioPublic
from app.services.nombres import con_nombre, con_nombres
from app.models.ticket import (
    TRANSICIONES_VALIDAS,
    Comentario,
    ComentarioCreate,
    Ticket,
    TicketCreate,
    TicketEstado,
    TicketPatch,
    TicketTipo,
    doc_to_comentario,
    doc_to_ticket,
)

COLLECTION = "tickets"
NOMBRES_TICKET = {"solicitante_id": "solicitante_nombre", "asignado_id": "asignado_nombre"}
NOMBRES_COMENTARIO = {"autor_id": "autor_nombre"}
COMENTARIOS = "ticket_comentarios"


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db[COLLECTION].create_index([("estado", 1), ("tipo", 1)])
    await db[COLLECTION].create_index("solicitante_id")
    await db[COLLECTION].create_index("asignado_id")
    await db[COMENTARIOS].create_index("ticket_id")


def _oid(resource_id: str, detail: str = "Ticket no encontrado") -> ObjectId:
    if not ObjectId.is_valid(resource_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return ObjectId(resource_id)


async def get_ticket(db: AsyncIOMotorDatabase, ticket_id: str) -> Ticket:
    doc = await db[COLLECTION].find_one({"_id": _oid(ticket_id)})
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")
    return await con_nombre(db, doc_to_ticket(doc), NOMBRES_TICKET)


# Roles que ven todas las solicitudes (gestión global y cuadro de mando).
ROLES_VEN_TODO = {"admin", "directiva"}


def filtro_visibilidad(user: UsuarioPublic) -> dict[str, Any]:
    """
    Condición Mongo con las solicitudes que el usuario puede ver: las que pidió, las que
    tiene asignadas y, si es responsable_ticket, las de los tipos de su competencia.
    Admin y directiva lo ven todo (filtro vacío). Espejo de `puede_ver_ticket`.
    """
    if ROLES_VEN_TODO & set(user.roles):
        return {}
    condiciones: list[dict[str, Any]] = [{"solicitante_id": user.id}, {"asignado_id": user.id}]
    if "responsable_ticket" in user.roles and user.competencias:
        condiciones.append({"tipo": {"$in": [c.value for c in user.competencias]}})
    return {"$or": condiciones}


async def list_tickets(
    db: AsyncIOMotorDatabase,
    *,
    viewer: UsuarioPublic,
    tipo: TicketTipo | None,
    estado: TicketEstado | None,
) -> list[Ticket]:
    query: dict[str, Any] = filtro_visibilidad(viewer)
    if tipo is not None:
        query["tipo"] = tipo.value
    if estado is not None:
        query["estado"] = estado.value
    cursor = db[COLLECTION].find(query).sort("creado_en", -1)
    return await con_nombres(db, [doc_to_ticket(doc) async for doc in cursor], NOMBRES_TICKET)


ESTADOS_ABIERTOS = [TicketEstado.abierto.value, TicketEstado.en_proceso.value]


async def responsables_de(db: AsyncIOMotorDatabase, tipo: TicketTipo) -> list[dict[str, Any]]:
    """Responsables activos con competencia sobre el tipo de solicitud."""
    cursor = db["usuarios"].find(
        {
            "estado": "activo",
            "roles": "responsable_ticket",
            "competencias": tipo.value,
        }
    ).sort("name", 1)
    return [doc async for doc in cursor]


async def elegir_responsable(db: AsyncIOMotorDatabase, tipo: TicketTipo) -> str | None:
    """Responsable del tipo con menos solicitudes abiertas (empate: orden alfabético)."""
    candidatos = await responsables_de(db, tipo)
    if not candidatos:
        return None
    ids = [str(u["_id"]) for u in candidatos]
    carga: dict[str, int] = dict.fromkeys(ids, 0)
    pipeline = [
        {"$match": {"asignado_id": {"$in": ids}, "estado": {"$in": ESTADOS_ABIERTOS}}},
        {"$group": {"_id": "$asignado_id", "n": {"$sum": 1}}},
    ]
    async for row in db[COLLECTION].aggregate(pipeline):
        carga[row["_id"]] = row["n"]
    return min(ids, key=lambda i: carga[i])


async def validar_asignable(db: AsyncIOMotorDatabase, usuario_id: str, tipo: TicketTipo) -> None:
    """El destino de una asignación debe ser responsable activo con la competencia del tipo."""
    if usuario_id not in {str(u["_id"]) for u in await responsables_de(db, tipo)}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El usuario asignado no es responsable activo de este tipo de solicitud",
        )


async def create_ticket(
    db: AsyncIOMotorDatabase,
    payload: TicketCreate,
    *,
    solicitante_id: str,
) -> Ticket:
    doc = {
        "tipo": payload.tipo.value,
        "titulo": payload.titulo,
        "descripcion": payload.descripcion,
        "datos": payload.datos,
        # Las publicaciones RRSS nacen con el borrador pendiente de generar.
        "borrador": {"estado": "pendiente"} if payload.tipo == TicketTipo.rrss else None,
        "estado": TicketEstado.abierto.value,
        "solicitante_id": solicitante_id,
        # Se asigna automáticamente al responsable del tipo (si existe).
        "asignado_id": await elegir_responsable(db, payload.tipo),
        "creado_en": datetime.now(UTC),
    }
    result = await db[COLLECTION].insert_one(doc)
    doc["_id"] = result.inserted_id
    return await con_nombre(db, doc_to_ticket(doc), NOMBRES_TICKET)


async def patch_ticket(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    payload: TicketPatch,
) -> Ticket:
    """Aplica patch; la autorización (quién puede) la comprueba el router."""
    current = await get_ticket(db, ticket_id)
    updates: dict[str, Any] = {}

    if payload.estado is not None:
        # Máquina: abierto → en_proceso → resuelto → cerrado (sin saltos).
        permitidos = TRANSICIONES_VALIDAS[current.estado]
        if payload.estado not in permitidos:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Transicion invalida: {current.estado.value} -> {payload.estado.value}"
                ),
            )
        updates["estado"] = payload.estado.value

    if payload.asignado_id is not None and payload.asignado_id != current.asignado_id:
        await validar_asignable(db, payload.asignado_id, current.tipo)
        updates["asignado_id"] = payload.asignado_id

    if not updates:
        return current

    updates["updated_at"] = datetime.now(UTC)
    result = await db[COLLECTION].find_one_and_update(
        {"_id": _oid(ticket_id)},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket no encontrado")
    return await con_nombre(db, doc_to_ticket(result), NOMBRES_TICKET)


async def list_comentarios(db: AsyncIOMotorDatabase, ticket_id: str) -> list[Comentario]:
    await get_ticket(db, ticket_id)
    cursor = db[COMENTARIOS].find({"ticket_id": ticket_id}).sort("creado_en", 1)
    return await con_nombres(db, [doc_to_comentario(doc) async for doc in cursor], NOMBRES_COMENTARIO)


async def create_comentario(
    db: AsyncIOMotorDatabase,
    ticket_id: str,
    payload: ComentarioCreate,
    *,
    autor_id: str,
) -> Comentario:
    await get_ticket(db, ticket_id)
    doc = {
        "ticket_id": ticket_id,
        "autor_id": autor_id,
        "cuerpo": payload.cuerpo,
        "creado_en": datetime.now(UTC),
    }
    result = await db[COMENTARIOS].insert_one(doc)
    doc["_id"] = result.inserted_id
    return await con_nombre(db, doc_to_comentario(doc), NOMBRES_COMENTARIO)


def puede_gestionar_ticket(user: UsuarioPublic, ticket: Ticket) -> bool:
    """
    Transiciones/asignación: admin siempre; responsable_ticket solo de los tipos
    en los que tiene competencia, y si es el asignado (o la solicitud está libre).
    """
    if "admin" in user.roles:
        return True
    if "responsable_ticket" in user.roles and ticket.tipo in user.competencias:
        return ticket.asignado_id is None or ticket.asignado_id == user.id
    return False


def puede_adjuntar(user: UsuarioPublic, ticket: Ticket) -> bool:
    """Subir archivos: quien pidió la solicitud, su responsable asignado o admin."""
    return "admin" in user.roles or user.id in (ticket.solicitante_id, ticket.asignado_id)


def _es_responsable_del_tipo(user: UsuarioPublic, ticket: Ticket) -> bool:
    return "responsable_ticket" in user.roles and ticket.tipo in user.competencias


def puede_ver_ticket(user: UsuarioPublic, ticket: Ticket) -> bool:
    """Leer la solicitud, sus comentarios y adjuntos. Espejo de `filtro_visibilidad`."""
    if ROLES_VEN_TODO & set(user.roles):
        return True
    return user.id in (ticket.solicitante_id, ticket.asignado_id) or _es_responsable_del_tipo(user, ticket)


def puede_comentar(user: UsuarioPublic, ticket: Ticket) -> bool:
    """Comentar: admin, solicitante, asignado o responsable con competencia en el tipo."""
    if "admin" in user.roles:
        return True
    return user.id in (ticket.solicitante_id, ticket.asignado_id) or _es_responsable_del_tipo(user, ticket)
