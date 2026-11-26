"""Endpoints de alumnado: búsqueda acotada e histórico de retrasos."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.alumno import Alumno
from app.models.retraso import RetrasoPaginated
from app.models.usuario import UsuarioPublic
from app.services import alumno_service, retraso_service

router = APIRouter(prefix="/alumnos", tags=["Alumnado"])

DocenteOAdmin = Annotated[UsuarioPublic, Depends(require_roles("docente", "admin"))]


@router.get("", response_model=list[Alumno])
async def list_alumnos(
    _current: DocenteOAdmin,
    grupo: str | None = None,
    q: Annotated[str | None, Query(max_length=80)] = None,
) -> list[Alumno]:
    """Selector de alumnado (máx. 50 resultados, sin datos sensibles)."""
    return await alumno_service.list_alumnos(get_db(), grupo=grupo, q=q)


@router.get("/{id}/retrasos", response_model=RetrasoPaginated, tags=["Retrasos"])
async def list_alumno_retrasos(
    id: str,
    current: DocenteOAdmin,
    curso_escolar: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> RetrasoPaginated:
    """Histórico individual del alumno (cada consulta queda auditada)."""
    return await retraso_service.list_por_alumno(
        get_db(),
        id,
        lector=current,
        curso_escolar=curso_escolar,
        page=page,
        limit=limit,
    )
