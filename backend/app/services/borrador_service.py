"""Borrador de texto para publicaciones en RRSS (ticket tipo rrss).

La generación usa el proveedor configurado (`IA_PROVEEDOR`); hoy, la plantilla
temporal. Nunca se publica nada: el equipo de RRSS copia el texto a mano.
"""

import logging

from bson import ObjectId
from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.ticket import Ticket, TicketTipo
from app.models.usuario import utcnow
from app.services.ia import EntradaBorrador, ErrorGeneracion, obtener_generador

logger = logging.getLogger(__name__)

PREFIJO = "Publicación:"


def entrada_de(ticket: Ticket) -> EntradaBorrador:
    titulo = ticket.titulo.removeprefix(PREFIJO).strip()
    return EntradaBorrador(
        titulo=titulo,
        departamento=str(ticket.datos.get("departamento") or ""),
        descripcion=ticket.descripcion or "",
        imagenes=[a.nombre for a in ticket.adjuntos],
    )


async def generar(db: AsyncIOMotorDatabase, ticket: Ticket) -> None:
    """Genera y guarda el borrador. Los fallos se guardan como estado `error`, no se propagan."""
    if ticket.tipo != TicketTipo.rrss:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Solo las publicaciones en RRSS tienen borrador",
        )
    try:
        borrador = await obtener_generador().generar(entrada_de(ticket))
        valor = {
            "estado": "listo",
            "texto": borrador.texto,
            "proveedor": borrador.proveedor,
            "modelo": borrador.modelo,
            "generado_en": utcnow(),
            "error": None,
        }
    except ErrorGeneracion as exc:
        valor = {"estado": "error", "error": str(exc), "generado_en": utcnow()}
    except Exception:
        logger.exception("Fallo inesperado generando el borrador del ticket %s", ticket.id)
        valor = {"estado": "error", "error": "No se pudo generar el borrador", "generado_en": utcnow()}
    await db["tickets"].update_one({"_id": ObjectId(ticket.id)}, {"$set": {"borrador": valor}})


async def generar_en_segundo_plano(db: AsyncIOMotorDatabase, ticket_id: str) -> None:
    """Para BackgroundTasks: relee el ticket (con sus adjuntos) y genera."""
    from app.services import ticket_service

    ticket = await ticket_service.get_ticket(db, ticket_id)
    await generar(db, ticket)
