"""Endpoints del dashboard de KPIs."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.dashboard import (
    ConfiguracionDashboard,
    ConfiguracionDashboardPut,
    DashboardFem,
    DashboardKpis,
    DashboardRetrasos,
    DashboardRrss,
)
from app.models.usuario import UsuarioPublic
from app.services import auditoria_service, dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

Direccion = Annotated[UsuarioPublic, Depends(require_roles("directiva", "admin"))]


@router.get("/kpis", response_model=DashboardKpis)
async def get_dashboard_kpis(_current: Direccion) -> DashboardKpis:
    """Indicadores consolidados del centro."""
    return await dashboard_service.get_kpis(get_db())


@router.get("/fem", response_model=DashboardFem)
async def get_dashboard_fem(_current: Direccion) -> DashboardFem:
    """KPI 5 (empresas FEM activas por municipio y ciclo) y KPI 6 (horas sobre las previstas)."""
    return await dashboard_service.get_fem(get_db())


@router.get("/rrss", response_model=DashboardRrss)
async def get_dashboard_rrss(_current: Direccion) -> DashboardRrss:
    """KPI 7 (publicaciones RRSS por departamento y porcentaje efectivamente publicado)."""
    return await dashboard_service.get_rrss(get_db())


@router.get("/retrasos", response_model=DashboardRetrasos)
async def get_dashboard_retrasos(
    _current: Direccion,
    curso_escolar: Annotated[str | None, Query(pattern=r"^\d{4}/\d{4}$", examples=["2026/2027"])] = None,
) -> DashboardRetrasos:
    """KPI 3: retrasos por grupo y módulo y alumnado sobre el umbral (por defecto, curso escolar actual)."""
    return await dashboard_service.get_retrasos(get_db(), curso_escolar=curso_escolar)


@router.get("/configuracion", response_model=ConfiguracionDashboard)
async def get_configuracion(_current: Direccion) -> ConfiguracionDashboard:
    """Parámetros del cuadro de mando que fija dirección (umbral de tasa alta de retrasos)."""
    return await dashboard_service.get_configuracion(get_db())


@router.put("/configuracion", response_model=ConfiguracionDashboard)
async def put_configuracion(payload: ConfiguracionDashboardPut, current: Direccion) -> ConfiguracionDashboard:
    db = get_db()
    antes, despues = await dashboard_service.put_configuracion(
        db, umbral_retrasos=payload.umbral_retrasos, usuario=current
    )
    await auditoria_service.record_required(
        db,
        accion="dashboard.configuracion_put",
        usuario_id=current.id,
        usuario_nombre=current.name,
        recurso_tipo="configuracion",
        recurso_id=dashboard_service.CONFIG_ID,
        detalle={
            "antes": {"umbral_retrasos": antes.umbral_retrasos},
            "despues": {"umbral_retrasos": despues.umbral_retrasos},
        },
    )
    return despues
