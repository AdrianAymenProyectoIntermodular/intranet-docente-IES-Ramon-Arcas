"""Endpoints de retrasos del alumnado (registro y detalle)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.retraso import Retraso, RetrasoCreate
from app.models.usuario import UsuarioPublic
from app.services import retraso_service

router = APIRouter(prefix="/retrasos", tags=["Retrasos"])

DocenteOAdmin = Annotated[UsuarioPublic, Depends(require_roles("docente", "admin"))]


@router.post("", response_model=Retraso, status_code=status.HTTP_201_CREATED)
async def create_retraso(
    payload: RetrasoCreate,
    response: Response,
    current: DocenteOAdmin,
) -> Retraso:
    """Registra un retraso; el autor sale del JWT."""
    retraso = await retraso_service.create_retraso(get_db(), payload, autor=current)
    response.headers["Location"] = f"/api/v1/retrasos/{retraso.id}"
    return retraso


@router.get("/{id}", response_model=Retraso)
async def get_retraso(id: str, _current: DocenteOAdmin) -> Retraso:
    return await retraso_service.get_retraso(get_db(), id)
