"""Esquemas del dashboard de KPIs."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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


class ConfiguracionDashboard(BaseModel):
    """Parámetros que fija el equipo directivo (no valores fijos en código)."""

    # Nº de retrasos en el curso escolar a partir del cual un alumno tiene "tasa alta" (KPI 3).
    umbral_retrasos: int
    actualizado_en: datetime | None = None
    actualizado_por_nombre: str | None = None


class ConfiguracionDashboardPut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    umbral_retrasos: int = Field(ge=1, le=100)


class RetrasosGrupo(BaseModel):
    grupo: str
    retrasos: int
    alumnos_con_retrasos: int
    alumnos_sobre_umbral: int


class RetrasosModulo(BaseModel):
    modulo: str
    retrasos: int


class AlumnoSobreUmbral(BaseModel):
    alumno_id: str
    nombre: str
    grupo: str
    retrasos: int


class DashboardRetrasos(BaseModel):
    """KPI 3: retrasos por grupo y módulo, y alumnado que alcanza el umbral de tasa alta."""

    curso_escolar: str
    umbral: int
    total: int
    por_grupo: list[RetrasosGrupo]
    por_modulo: list[RetrasosModulo]
    alumnado_sobre_umbral: list[AlumnoSobreUmbral]


class DashboardFem(BaseModel):
    """KPI 5 (empresas activas por municipio y ciclo) y KPI 6 (horas sobre las previstas)."""

    empresas_total: int
    empresas_activas: int
    porcentaje_activas: float
    por_municipio: list[ProporcionActivas]
    por_ciclo: list[ProporcionActivas]
    horas: HorasFem
