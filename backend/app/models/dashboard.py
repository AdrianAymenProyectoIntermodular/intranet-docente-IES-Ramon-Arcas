"""Esquemas del dashboard de KPIs."""

from pydantic import BaseModel


class DashboardKpis(BaseModel):
    ausencias_hoy: int = 0
    guardias_pendientes: int = 0
    tickets_abiertos: int = 0
    docentes_activos: int = 0
    alumnos_fem_activos: int = 0


class ProporcionActivas(BaseModel):
    """Empresas activas sobre las registradas en un municipio o ciclo."""

    nombre: str
    total: int
    activas: int
    porcentaje: float


class HorasFem(BaseModel):
    alumnos: int
    cursadas: float
    previstas: float
    porcentaje: float


class PublicacionesDepartamento(BaseModel):
    """Solicitudes de publicación RRSS de un departamento y cuántas se han publicado."""

    nombre: str
    total: int
    publicadas: int
    porcentaje: float


class DashboardRrss(BaseModel):
    """KPI 7: publicaciones RRSS por departamento y porcentaje efectivamente publicado.

    Se considera publicada una solicitud resuelta o cerrada (el administrador de RRSS la
    marca así tras publicarla a mano).
    """

    total: int
    publicadas: int
    porcentaje: float
    por_departamento: list[PublicacionesDepartamento]


class DashboardFem(BaseModel):
    """KPI 5 (empresas activas por municipio y ciclo) y KPI 6 (horas sobre las previstas)."""

    empresas_total: int
    empresas_activas: int
    porcentaje_activas: float
    por_municipio: list[ProporcionActivas]
    por_ciclo: list[ProporcionActivas]
    horas: HorasFem
