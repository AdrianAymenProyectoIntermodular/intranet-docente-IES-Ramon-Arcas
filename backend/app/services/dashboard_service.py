"""Servicio de KPIs del dashboard."""

from datetime import UTC, date, datetime

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.dashboard import (
    AlumnoSobreUmbral,
    ConfiguracionDashboard,
    DashboardFem,
    DashboardKpis,
    DashboardRetrasos,
    DashboardRrss,
    HorasFem,
    ProporcionActivas,
    PublicacionesDepartamento,
    RetrasosGrupo,
    RetrasosModulo,
)
from app.models.usuario import UsuarioPublic
from app.services.retraso_service import curso_escolar_de
from app.models.ticket import TicketEstado, TicketTipo
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


CONFIGURACION = "configuracion"
CONFIG_ID = "dashboard"
# Valor inicial hasta que dirección lo cambie; el umbral vigente siempre se lee de Mongo.
UMBRAL_RETRASOS_INICIAL = 5


async def get_configuracion(db: AsyncIOMotorDatabase) -> ConfiguracionDashboard:
    doc = await db[CONFIGURACION].find_one({"_id": CONFIG_ID}) or {}
    return ConfiguracionDashboard(
        umbral_retrasos=int(doc.get("umbral_retrasos", UMBRAL_RETRASOS_INICIAL)),
        actualizado_en=doc.get("actualizado_en"),
        actualizado_por_nombre=doc.get("actualizado_por_nombre"),
    )


async def put_configuracion(
    db: AsyncIOMotorDatabase, *, umbral_retrasos: int, usuario: UsuarioPublic
) -> tuple[ConfiguracionDashboard, ConfiguracionDashboard]:
    """Guarda la configuración y devuelve (antes, después) para la auditoría."""
    antes = await get_configuracion(db)
    await db[CONFIGURACION].update_one(
        {"_id": CONFIG_ID},
        {
            "$set": {
                "umbral_retrasos": umbral_retrasos,
                "actualizado_en": datetime.now(UTC),
                "actualizado_por_id": usuario.id,
                "actualizado_por_nombre": usuario.name,
            }
        },
        upsert=True,
    )
    return antes, await get_configuracion(db)


async def get_retrasos(db: AsyncIOMotorDatabase, *, curso_escolar: str | None = None) -> DashboardRetrasos:
    """KPI 3: retrasos del curso escolar por grupo y módulo y alumnado que alcanza el umbral."""
    curso = curso_escolar or curso_escolar_de(date.today())
    umbral = (await get_configuracion(db)).umbral_retrasos
    filtro = {"curso_escolar": curso}

    por_alumno = await db["retrasos"].aggregate(
        [
            {"$match": filtro},
            {"$group": {"_id": "$alumno_id", "retrasos": {"$sum": 1}, "grupo": {"$first": "$grupo"}}},
        ]
    ).to_list(None)
    por_modulo = await db["retrasos"].aggregate(
        [
            {"$match": filtro},
            {"$group": {"_id": "$modulo", "retrasos": {"$sum": 1}}},
            {"$sort": {"retrasos": -1, "_id": 1}},
        ]
    ).to_list(None)

    grupos: dict[str, RetrasosGrupo] = {}
    sobre_umbral = [a for a in por_alumno if a["retrasos"] >= umbral]
    for a in por_alumno:
        nombre_grupo = a.get("grupo") or "Sin grupo"
        g = grupos.setdefault(
            nombre_grupo,
            RetrasosGrupo(grupo=nombre_grupo, retrasos=0, alumnos_con_retrasos=0, alumnos_sobre_umbral=0),
        )
        g.retrasos += a["retrasos"]
        g.alumnos_con_retrasos += 1
        g.alumnos_sobre_umbral += 1 if a["retrasos"] >= umbral else 0

    ids = [ObjectId(a["_id"]) for a in sobre_umbral if ObjectId.is_valid(a["_id"])]
    nombres = {str(d["_id"]): d.get("nombre", "") async for d in db["alumnos"].find({"_id": {"$in": ids}}, {"nombre": 1})}
    alumnado = sorted(
        (
            AlumnoSobreUmbral(
                alumno_id=a["_id"],
                nombre=nombres.get(a["_id"], "Alumno desconocido"),
                grupo=a.get("grupo") or "Sin grupo",
                retrasos=a["retrasos"],
            )
            for a in sobre_umbral
        ),
        key=lambda x: (-x.retrasos, x.nombre),
    )

    return DashboardRetrasos(
        curso_escolar=curso,
        umbral=umbral,
        total=sum(a["retrasos"] for a in por_alumno),
        por_grupo=sorted(grupos.values(), key=lambda g: (-g.retrasos, g.grupo)),
        por_modulo=[RetrasosModulo(modulo=m["_id"] or "Sin módulo", retrasos=m["retrasos"]) for m in por_modulo],
        alumnado_sobre_umbral=alumnado,
    )


# Una publicación RRSS cuenta como publicada cuando su solicitud está resuelta o cerrada.
ESTADOS_PUBLICADA = [TicketEstado.resuelto.value, TicketEstado.cerrado.value]


async def get_rrss(db: AsyncIOMotorDatabase) -> DashboardRrss:
    """KPI 7: solicitudes de publicación RRSS por departamento y porcentaje publicado."""
    filas = await db["tickets"].aggregate(
        [
            {"$match": {"tipo": TicketTipo.rrss.value}},
            {
                "$group": {
                    "_id": {"$ifNull": ["$datos.departamento", "Sin departamento"]},
                    "total": {"$sum": 1},
                    "publicadas": {"$sum": {"$cond": [{"$in": ["$estado", ESTADOS_PUBLICADA]}, 1, 0]}},
                }
            },
            {"$sort": {"total": -1, "_id": 1}},
        ]
    ).to_list(None)
    total = sum(f["total"] for f in filas)
    publicadas = sum(f["publicadas"] for f in filas)
    return DashboardRrss(
        total=total,
        publicadas=publicadas,
        porcentaje=_porcentaje(publicadas, total),
        por_departamento=[
            PublicacionesDepartamento(
                nombre=f["_id"] or "Sin departamento",
                total=f["total"],
                publicadas=f["publicadas"],
                porcentaje=_porcentaje(f["publicadas"], f["total"]),
            )
            for f in filas
        ],
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
