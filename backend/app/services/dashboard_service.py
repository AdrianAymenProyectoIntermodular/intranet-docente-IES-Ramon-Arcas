"""Servicio de KPIs del dashboard."""

from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.dashboard import DashboardFem, DashboardKpis, HorasFem, ProporcionActivas
from app.models.ticket import TicketEstado
from app.models.usuario import UsuarioEstado


async def get_kpis(db: AsyncIOMotorDatabase) -> DashboardKpis:
    """Agrega contadores desde las colecciones existentes."""
    hoy = datetime.now(UTC).date().isoformat()

    ausencias_hoy = await db["ausencias"].count_documents(
        {"fecha_inicio": {"$lte": hoy}, "fecha_fin": {"$gte": hoy}}
    )
    guardias_pendientes = await db["guardias"].count_documents({"estado": "pendiente"})
    tickets_abiertos = await db["tickets"].count_documents(
        {"estado": {"$in": [TicketEstado.abierto.value, TicketEstado.en_proceso.value]}}
    )
    docentes_activos = await db["usuarios"].count_documents(
        {"estado": UsuarioEstado.activo.value}
    )
    alumnos_fem_activos = await db["fem_alumnos"].count_documents({"estado": "activo"})

    return DashboardKpis(
        ausencias_hoy=ausencias_hoy,
        guardias_pendientes=guardias_pendientes,
        tickets_abiertos=tickets_abiertos,
        docentes_activos=docentes_activos,
        alumnos_fem_activos=alumnos_fem_activos,
    )


def _porcentaje(parte: float, total: float) -> float:
    return round(parte * 100 / total, 1) if total else 0.0


def _proporciones(datos: dict[str, list[int]]) -> list[ProporcionActivas]:
    """{nombre: [total, activas]} → lista ordenada por tamaño."""
    return sorted(
        (
            ProporcionActivas(nombre=k, total=t, activas=a, porcentaje=_porcentaje(a, t))
            for k, (t, a) in datos.items()
        ),
        key=lambda p: (-p.total, p.nombre),
    )


async def get_fem(db: AsyncIOMotorDatabase) -> DashboardFem:
    """KPI 5 (empresas activas por municipio y ciclo) y KPI 6 (horas cursadas sobre previstas)."""
    empresas = [e async for e in db["fem_empresas"].find({}, {"municipio": 1, "ciclos": 1, "activa": 1})]
    por_municipio: dict[str, list[int]] = {}
    por_ciclo: dict[str, list[int]] = {}
    for e in empresas:
        activa = 1 if e.get("activa", True) else 0
        m = por_municipio.setdefault(e.get("municipio") or "Sin municipio", [0, 0])
        m[0] += 1
        m[1] += activa
        for ciclo in e.get("ciclos") or []:
            c = por_ciclo.setdefault(ciclo, [0, 0])
            c[0] += 1
            c[1] += activa

    resumen = await db["fem_alumnos"].aggregate(
        [
            {
                "$group": {
                    "_id": None,
                    "alumnos": {"$sum": 1},
                    "cursadas": {"$sum": "$horas_cursadas"},
                    "previstas": {"$sum": {"$ifNull": ["$horas_totales", 500]}},
                }
            }
        ]
    ).to_list(1)
    h = resumen[0] if resumen else {"alumnos": 0, "cursadas": 0, "previstas": 0}
    activas = sum(1 for e in empresas if e.get("activa", True))
    return DashboardFem(
        empresas_total=len(empresas),
        empresas_activas=activas,
        porcentaje_activas=_porcentaje(activas, len(empresas)),
        por_municipio=_proporciones(por_municipio),
        por_ciclo=_proporciones(por_ciclo),
        horas=HorasFem(
            alumnos=h["alumnos"],
            cursadas=float(h["cursadas"]),
            previstas=float(h["previstas"]),
            porcentaje=_porcentaje(h["cursadas"], h["previstas"]),
        ),
    )
