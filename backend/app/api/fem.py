"""Endpoints FEM (Formación en Empresas Murcia)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.fem import Empresa, EmpresaCreate, EmpresaPatch, FemAlumno, FemHorasPatch
from app.models.usuario import UsuarioPublic
from app.services import auditoria_service, fem_empresa_service, fem_service

router = APIRouter(prefix="/fem", tags=["FEM"])


@router.get("/alumnos", response_model=list[FemAlumno])
async def list_fem_alumnos(
    current: Annotated[UsuarioPublic, Depends(require_roles("tutor", "admin"))],
    estado: str | None = None,
) -> list[FemAlumno]:
    """Alumnado asignado al tutor (admin ve todos)."""
    is_admin = "admin" in current.roles
    return await fem_service.list_alumnos(
        get_db(),
        tutor_id=None if is_admin else current.id,
        is_admin=is_admin,
        estado=estado,
    )


@router.patch("/alumnos/{id}/horas", response_model=FemAlumno)
async def patch_fem_horas(
    id: str,
    payload: FemHorasPatch,
    current: Annotated[UsuarioPublic, Depends(require_roles("tutor", "admin"))],
) -> FemAlumno:
    """Actualizar horas cursadas (máx. 500)."""
    is_admin = "admin" in current.roles
    db = get_db()
    alumno, horas_antes = await fem_service.patch_horas(
        db,
        id,
        payload,
        tutor_id=None if is_admin else current.id,
        is_admin=is_admin,
    )
    await auditoria_service.record_required(
        db,
        accion="fem.horas_patch",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="fem_alumno",
        recurso_id=id,
        detalle={"antes": horas_antes, "despues": alumno.horas_cursadas},
    )
    return alumno


@router.get("/empresas", response_model=list[Empresa])
async def list_empresas(
    _current: Annotated[UsuarioPublic, Depends(require_roles("tutor", "admin", "directiva"))],
    municipio: str | None = None,
    ciclo: str | None = None,
    activa: bool | None = None,
) -> list[Empresa]:
    """Empresas colaboradoras con su ubicación (para el mapa) y alumnado en prácticas."""
    return await fem_empresa_service.listar(get_db(), municipio=municipio, ciclo=ciclo, activa=activa)


@router.post("/empresas", response_model=Empresa, status_code=status.HTTP_201_CREATED)
async def create_empresa(
    payload: EmpresaCreate,
    response: Response,
    current: Annotated[UsuarioPublic, Depends(require_roles("admin"))],
) -> Empresa:
    """Alta de empresa; la dirección se geocodifica con Nominatim."""
    db = get_db()
    empresa = await fem_empresa_service.crear(db, payload)
    await auditoria_service.record(
        db,
        accion="fem.empresa_create",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="fem_empresa",
        recurso_id=empresa.id,
        detalle={"nombre": empresa.nombre, "geocodificada": empresa.geocodificada},
    )
    response.headers["Location"] = f"/api/v1/fem/empresas/{empresa.id}"
    return empresa


@router.patch("/empresas/{id}", response_model=Empresa)
async def patch_empresa(
    id: str,
    payload: EmpresaPatch,
    current: Annotated[UsuarioPublic, Depends(require_roles("admin"))],
) -> Empresa:
    db = get_db()
    empresa = await fem_empresa_service.actualizar(db, id, payload)
    await auditoria_service.record(
        db,
        accion="fem.empresa_patch",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="fem_empresa",
        recurso_id=id,
        detalle={"cambios": payload.model_dump(exclude_unset=True)},
    )
    return empresa


@router.post("/empresas/{id}/geocodificar", response_model=Empresa)
async def geocodificar_empresa(
    id: str,
    current: Annotated[UsuarioPublic, Depends(require_roles("admin"))],
) -> Empresa:
    """Reintenta situar la empresa en el mapa (si Nominatim falló en el alta)."""
    db = get_db()
    empresa = await fem_empresa_service.reintentar_geocodificacion(db, id)
    await auditoria_service.record(
        db,
        accion="fem.empresa_geocodificar",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="fem_empresa",
        recurso_id=id,
        detalle={"geocodificada": empresa.geocodificada},
    )
    return empresa
