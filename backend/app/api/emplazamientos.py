"""Endpoints de emplazamiento del alumnado en el aula."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.emplazamiento import Emplazamiento, EmplazamientoCreate
from app.models.usuario import UsuarioPublic
from app.services import emplazamiento_service

router = APIRouter(prefix="/emplazamientos", tags=["Emplazamientos"])

DocenteOAdmin = Annotated[UsuarioPublic, Depends(require_roles("docente", "admin"))]


@router.get("", response_model=list[Emplazamiento])
async def listar(
    _current: DocenteOAdmin,
    grupo: Annotated[str | None, Query(max_length=20)] = None,
    modulo: Annotated[str | None, Query(max_length=80)] = None,
) -> list[Emplazamiento]:
    """Diseños guardados de una clase (grupo + módulo), más recientes primero."""
    return await emplazamiento_service.listar(get_db(), grupo=grupo, modulo=modulo)


@router.post("", response_model=Emplazamiento, status_code=status.HTTP_201_CREATED)
async def crear(payload: EmplazamientoCreate, response: Response, current: DocenteOAdmin) -> Emplazamiento:
    emplazamiento = await emplazamiento_service.crear(get_db(), payload, autor=current)
    response.headers["Location"] = f"/api/v1/emplazamientos/{emplazamiento.id}"
    return emplazamiento


@router.get("/{id}", response_model=Emplazamiento)
async def obtener(id: str, _current: DocenteOAdmin) -> Emplazamiento:
    return await emplazamiento_service.obtener(get_db(), id)


@router.put("/{id}", response_model=Emplazamiento)
async def reemplazar(id: str, payload: EmplazamientoCreate, current: DocenteOAdmin) -> Emplazamiento:
    """Sustituye el diseño completo (solo autor o admin)."""
    return await emplazamiento_service.reemplazar(get_db(), id, payload, usuario=current)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def borrar(id: str, current: DocenteOAdmin) -> Response:
    await emplazamiento_service.borrar(get_db(), id, usuario=current)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
