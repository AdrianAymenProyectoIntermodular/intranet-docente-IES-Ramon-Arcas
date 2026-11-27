"""Endpoints de anuncios."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.database import get_db
from app.core.deps import CurrentActiveUser, require_roles
from app.models.anuncio import Anuncio, AnuncioCreate, AnuncioFijar
from app.models.usuario import UsuarioPublic
from app.services import anuncio_service, auditoria_service

router = APIRouter(prefix="/anuncios", tags=["Anuncios"])


@router.get("", response_model=list[Anuncio])
async def list_anuncios(
    current: CurrentActiveUser,
    departamento: str | None = None,
    curso: Annotated[str | None, Query(max_length=40)] = None,
) -> list[Anuncio]:
    """Feed segmentado por ámbito (general / departamento del usuario) y, opcionalmente, por curso."""
    return await anuncio_service.list_anuncios(
        get_db(),
        departamento=departamento,
        viewer_departamento=current.departamento,
        curso=curso,
    )


@router.post("", response_model=Anuncio, status_code=status.HTTP_201_CREATED)
async def create_anuncio(
    payload: AnuncioCreate,
    response: Response,
    current: Annotated[UsuarioPublic, Depends(require_roles("admin", "directiva"))],
) -> Anuncio:
    """Publicar anuncio; admin o directiva."""
    db = get_db()
    anuncio = await anuncio_service.create_anuncio(db, payload, autor_id=current.id)
    await auditoria_service.record_required(
        db,
        accion="anuncios.create",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="anuncio",
        recurso_id=anuncio.id,
        detalle={"titulo": anuncio.titulo, "departamento": anuncio.departamento, "curso": anuncio.curso},
    )
    response.headers["Location"] = f"/api/v1/anuncios/{anuncio.id}"
    return anuncio


@router.patch("/{id}/fijar", response_model=Anuncio)
async def fijar_anuncio(
    id: str,
    payload: AnuncioFijar,
    current: Annotated[UsuarioPublic, Depends(require_roles("admin"))],
) -> Anuncio:
    """Fijar o desfijar anuncio (solo admin)."""
    db = get_db()
    anuncio = await anuncio_service.fijar_anuncio(db, id, payload.fijado)
    await auditoria_service.record_required(
        db,
        accion="anuncios.fijar",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="anuncio",
        recurso_id=anuncio.id,
        detalle={"fijado": payload.fijado},
    )
    return anuncio
