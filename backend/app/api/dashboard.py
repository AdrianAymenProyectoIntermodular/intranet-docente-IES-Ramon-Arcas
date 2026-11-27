"""Endpoints del dashboard de KPIs."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.dashboard import DashboardFem, DashboardKpis, DashboardRrss
from app.models.usuario import UsuarioPublic
from app.services import dashboard_service

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
