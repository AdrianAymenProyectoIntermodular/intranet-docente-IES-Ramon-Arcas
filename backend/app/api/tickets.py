"""Endpoints de tickets y comentarios."""

from typing import Annotated

from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Response, UploadFile, status

from app.core.database import get_db
from app.core.deps import CurrentActiveUser, require_roles
from app.models.ticket import (
    AdjuntoMeta,
    Comentario,
    ComentarioCreate,
    Ticket,
    TicketCreate,
    TicketEstado,
    TicketPatch,
    TicketTipo,
)
from app.models.usuario import UsuarioPublic
from app.services import adjunto_service, auditoria_service, borrador_service, ticket_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])


@router.get("", response_model=list[Ticket])
async def list_tickets(
    _current: CurrentActiveUser,
    tipo: TicketTipo | None = None,
    estado: TicketEstado | None = None,
) -> list[Ticket]:
    return await ticket_service.list_tickets(get_db(), tipo=tipo, estado=estado)


@router.post("", response_model=Ticket, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: TicketCreate,
    response: Response,
    current: CurrentActiveUser,
    tareas: BackgroundTasks,
) -> Ticket:
    ticket = await ticket_service.create_ticket(
        get_db(), payload, solicitante_id=current.id
    )
    if ticket.tipo == TicketTipo.rrss:
        # Tras responder: el docente no espera a que se genere el texto.
        tareas.add_task(borrador_service.generar_en_segundo_plano, get_db(), ticket.id)
    response.headers["Location"] = f"/api/v1/tickets/{ticket.id}"
    return ticket


@router.post("/{id}/borrador", response_model=Ticket)
async def regenerar_borrador(id: str, current: CurrentActiveUser) -> Ticket:
    """Vuelve a generar el borrador de una publicación RRSS (p. ej. tras añadir imágenes)."""
    db = get_db()
    ticket = await ticket_service.get_ticket(db, id)
    if not ticket_service.puede_adjuntar(current, ticket):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo quien pidió la publicación, su responsable o administración pueden regenerar el borrador",
        )
    await borrador_service.generar(db, ticket)
    return await ticket_service.get_ticket(db, id)


@router.patch("/{id}", response_model=Ticket)
async def patch_ticket(
    id: str,
    payload: TicketPatch,
    current: Annotated[
        UsuarioPublic, Depends(require_roles("admin", "responsable_ticket"))
    ],
) -> Ticket:
    ticket = await ticket_service.get_ticket(get_db(), id)
    if not ticket_service.puede_gestionar_ticket(current, ticket):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sin permiso para gestionar este ticket",
        )
    # Un responsable solo puede asignarse a sí mismo; reasignar a otros es de admin.
    if (
        payload.asignado_id is not None
        and payload.asignado_id != current.id
        and "admin" not in current.roles
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo administración puede asignar la solicitud a otra persona",
        )
    return await ticket_service.patch_ticket(get_db(), id, payload)


@router.get("/{id}/comentarios", response_model=list[Comentario])
async def list_comentarios(id: str, current: CurrentActiveUser) -> list[Comentario]:
    ticket = await ticket_service.get_ticket(get_db(), id)
    if not ticket_service.puede_comentar(current.roles, ticket, current.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sin permiso para ver comentarios de este ticket",
        )
    return await ticket_service.list_comentarios(get_db(), id)


@router.post(
    "/{id}/comentarios",
    response_model=Comentario,
    status_code=status.HTTP_201_CREATED,
)
async def create_comentario(
    id: str,
    payload: ComentarioCreate,
    response: Response,
    current: CurrentActiveUser,
) -> Comentario:
    ticket = await ticket_service.get_ticket(get_db(), id)
    if not ticket_service.puede_comentar(current.roles, ticket, current.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sin permiso para comentar este ticket",
        )
    comentario = await ticket_service.create_comentario(
        get_db(), id, payload, autor_id=current.id
    )
    response.headers["Location"] = f"/api/v1/tickets/{id}/comentarios/{comentario.id}"
    return comentario


@router.post(
    "/{id}/adjuntos",
    response_model=AdjuntoMeta,
    status_code=status.HTTP_201_CREATED,
)
async def subir_adjunto(
    id: str,
    response: Response,
    current: CurrentActiveUser,
    archivo: UploadFile = File(...),
) -> AdjuntoMeta:
    """Imágenes (RRSS, RMI) o presupuesto (compras). Máx. 5 MB y 10 por solicitud."""
    db = get_db()
    ticket = await ticket_service.get_ticket(db, id)
    if not ticket_service.puede_adjuntar(current, ticket):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo quien pidió la solicitud, su responsable o administración pueden adjuntar archivos",
        )
    meta = await adjunto_service.subir(db, ticket, archivo, usuario_id=current.id)
    await auditoria_service.record_required(
        db,
        accion="tickets.adjunto_create",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="ticket",
        recurso_id=ticket.id,
        detalle={"adjunto_id": meta.id, "nombre": meta.nombre, "tamano": meta.tamano},
    )
    response.headers["Location"] = f"/api/v1/tickets/{id}/adjuntos/{meta.id}"
    return meta


@router.get("/{id}/adjuntos/{adjunto_id}", response_class=Response)
async def descargar_adjunto(id: str, adjunto_id: str, current: CurrentActiveUser) -> Response:
    db = get_db()
    ticket = await ticket_service.get_ticket(db, id)
    if not ticket_service.puede_comentar(current.roles, ticket, current.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sin permiso para ver los adjuntos de esta solicitud",
        )
    meta = adjunto_service.buscar(ticket, adjunto_id)
    contenido = await adjunto_service.leer(db, meta)
    return Response(
        content=contenido,
        media_type=meta.tipo_mime,
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(meta.nombre)}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "private, max-age=300",
        },
    )


@router.delete("/{id}/adjuntos/{adjunto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def borrar_adjunto(id: str, adjunto_id: str, current: CurrentActiveUser) -> Response:
    db = get_db()
    ticket = await ticket_service.get_ticket(db, id)
    meta = adjunto_service.buscar(ticket, adjunto_id)
    if "admin" not in current.roles and meta.subido_por_id != current.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo quien subió el archivo o administración pueden borrarlo",
        )
    await adjunto_service.borrar(db, ticket, meta)
    await auditoria_service.record_required(
        db,
        accion="tickets.adjunto_delete",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="ticket",
        recurso_id=ticket.id,
        detalle={"adjunto_id": meta.id, "nombre": meta.nombre},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
