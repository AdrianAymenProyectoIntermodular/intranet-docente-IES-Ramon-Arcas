"""Carga datos de demostración FICTICIOS en MongoDB (solo ENVIRONMENT=development).

Uso (contenedor):
    docker compose exec backend python -m scripts.seed_demo --admin-email tu@correo

Uso (venv local, Mongo expuesto en localhost):
    MONGODB_URI=mongodb://localhost:27017 python -m scripts.seed_demo --admin-email tu@correo

Idempotente: borra y reinserta solo los documentos marcados con ``seed: true``.
Todos los nombres de personas y empresas son inventados.
"""

from __future__ import annotations

import argparse
import asyncio
import random
from datetime import UTC, date, datetime, timedelta
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings
from app.services.retraso_service import curso_escolar_de

SEED = {"seed": True}
rng = random.Random(20261126)

DEPARTAMENTOS = [
    "Informática",
    "Matemáticas",
    "Lengua Castellana",
    "Inglés",
    "Geografía e Historia",
    "Física y Química",
]

# (nombre, email, departamento, roles)
DOCENTES: list[tuple[str, str, str, list[str]]] = [
    ("Elena Robles Marín", "elena.robles@demo.intranet", "Matemáticas", ["docente", "directiva"]),
    ("Javier Soler Ibáñez", "javier.soler@demo.intranet", "Geografía e Historia", ["docente", "jefatura"]),
    ("Marta Cánovas Ruiz", "marta.canovas@demo.intranet", "Informática", ["docente", "tutor"]),
    ("Andrés Peñalver Gil", "andres.penalver@demo.intranet", "Informática", ["docente", "responsable_ticket"]),
    ("Lucía Navarro Sáez", "lucia.navarro@demo.intranet", "Lengua Castellana", ["docente"]),
    ("Pablo Mena Cortés", "pablo.mena@demo.intranet", "Inglés", ["docente", "tutor"]),
    ("Irene Ferrer Lozano", "irene.ferrer@demo.intranet", "Física y Química", ["docente"]),
    ("Sergio Alcaraz Vidal", "sergio.alcaraz@demo.intranet", "Matemáticas", ["docente", "responsable_ticket"]),
]
PENDIENTES = [
    ("Nuria Belmonte Ros", "nuria.belmonte@demo.intranet"),
    ("Hugo Carrasco Pina", "hugo.carrasco@demo.intranet"),
]

GRUPOS = {
    "1ESO-A": ("1º ESO", ["Matemáticas", "Lengua Castellana", "Inglés", "Geografía e Historia"]),
    "2ESO-B": ("2º ESO", ["Matemáticas", "Física y Química", "Inglés", "Lengua Castellana"]),
    "1DAW": ("1º DAW", ["Programación", "Bases de Datos", "Lenguajes de Marcas", "Sistemas Informáticos"]),
    "2DAW": ("2º DAW", ["DWES", "DWEC", "DIW", "Despliegue"]),
}
NOMBRES = [
    "Aitana", "Bruno", "Carla", "Daniel", "Eva", "Fernando", "Gala", "Héctor", "Inés", "Jorge",
    "Laia", "Marcos", "Noa", "Óscar", "Paula", "Rubén", "Sara", "Tomás", "Valeria", "Yago",
]
APELLIDOS = [
    "Albarracín", "Bermejo", "Cervantes", "Díez", "Escobar", "Fuentes", "Galindo", "Hidalgo",
    "Iniesta", "Jover", "Llamas", "Molina", "Nicolás", "Olmedo", "Prieto", "Quiles", "Rosique",
]
EMPRESAS = [
    "Soluciones Digitales Guadalentín S.L.",
    "Nexo Software Lorca",
    "Cooperativa TecnoSur",
    "Estudio Web Alameda",
    "Redes y Sistemas del Sureste",
    "Agencia Creativa Puerta Nueva",
]

FRANJAS = [
    ("08:15", "09:10"),
    ("09:10", "10:05"),
    ("10:05", "11:00"),
    ("11:30", "12:25"),
    ("12:25", "13:20"),
    ("13:20", "14:15"),
]
DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"]
AULAS = ["A1", "A2", "B1", "B2", "Lab. Informática", "Aula Plumier"]


def now() -> datetime:
    return datetime.now(UTC)


def horario_para(departamento: str) -> dict[str, list[dict[str, Any]]]:
    """Semana realista: ~18 clases, 2-3 guardias y alguna reducción."""
    grupos = list(GRUPOS)
    asignaturas = {
        "Informática": ["Programación", "DWES", "DWEC", "Bases de Datos"],
    }.get(departamento, [departamento])
    dias: dict[str, list[dict[str, Any]]] = {}
    guardias = 0
    reducciones = 0
    for dia in DIAS:
        bloques: list[dict[str, Any]] = []
        for inicio, fin in FRANJAS:
            r = rng.random()
            if r < 0.62:
                bloques.append(
                    {
                        "inicio": inicio,
                        "fin": fin,
                        "tipo": "clase",
                        "asignatura": rng.choice(asignaturas),
                        "grupo": rng.choice(grupos),
                        "aula": rng.choice(AULAS),
                    }
                )
            elif r < 0.74 and guardias < 3:
                guardias += 1
                bloques.append({"inicio": inicio, "fin": fin, "tipo": "guardia"})
            elif r < 0.80 and reducciones < 2:
                reducciones += 1
                bloques.append(
                    {"inicio": inicio, "fin": fin, "tipo": "reduccion", "asignatura": "Coordinación"}
                )
        dias[dia] = bloques
    return dias


async def limpiar(db: AsyncIOMotorDatabase) -> None:
    for col in ("usuarios", "anuncios", "tickets", "ticket_comentarios", "fem_alumnos", "alumnos", "retrasos"):
        await db[col].delete_many(SEED)


async def sembrar_usuarios(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    for nombre, email, dep, roles in DOCENTES:
        docs.append(
            {
                **SEED,
                "name": nombre,
                "email": email,
                "departamento": dep,
                "roles": roles,
                "estado": "activo",
                "origen_alta": "manual",
                "google_sub": None,
                "horario": horario_para(dep),
                "created_at": now(),
                "updated_at": now(),
            }
        )
    for nombre, email in PENDIENTES:
        docs.append(
            {
                **SEED,
                "name": nombre,
                "email": email,
                "departamento": "",
                "roles": ["docente"],
                "estado": "pendiente",
                "origen_alta": "oauth",
                "google_sub": None,
                "horario": {},
                "created_at": now(),
                "updated_at": now(),
            }
        )
    result = await db["usuarios"].insert_many(docs)
    for doc, oid in zip(docs, result.inserted_ids, strict=True):
        doc["_id"] = oid
    return docs


async def preparar_admin(db: AsyncIOMotorDatabase, email: str) -> dict[str, Any]:
    """Activa (o crea) la cuenta real del usuario como admin. No se marca como seed."""
    email = email.strip().lower()
    base = {
        "estado": "activo",
        "roles": ["admin", "docente", "tutor"],
        "updated_at": now(),
    }
    existente = await db["usuarios"].find_one({"email": email})
    if existente:
        updates: dict[str, Any] = dict(base)
        if not existente.get("departamento"):
            updates["departamento"] = "Informática"
        horario = existente.get("horario") or {}
        if sum(len(v) for v in horario.values()) < 6:
            updates["horario"] = horario_para("Informática")
        await db["usuarios"].update_one({"_id": existente["_id"]}, {"$set": updates})
        return await db["usuarios"].find_one({"_id": existente["_id"]}) or existente
    doc = {
        **base,
        "name": email.split("@")[0].replace(".", " ").title(),
        "email": email,
        "departamento": "Informática",
        "origen_alta": "manual",
        "google_sub": None,
        "horario": horario_para("Informática"),
        "created_at": now(),
    }
    result = await db["usuarios"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def sembrar_anuncios(db: AsyncIOMotorDatabase, autores: list[dict[str, Any]]) -> int:
    directiva = next(u for u in autores if "directiva" in u["roles"])
    anuncios = [
        ("Claustro ordinario del primer trimestre",
         "Se convoca claustro ordinario el próximo jueves a las 16:30 en el salón de actos. "
         "Orden del día: evaluación inicial, plan de convivencia y propuestas de mejora.",
         None, True, None, 1),
        ("Entrega de notas de la primera evaluación",
         "Las calificaciones deben estar introducidas en Plumier XXI antes del viernes 12. "
         "Recordad revisar las observaciones de cada grupo.",
         None, True, 20, 2),
        ("Simulacro de evacuación",
         "La próxima semana se realizará un simulacro de evacuación sin previo aviso. "
         "Revisad el plan de autoprotección en el tablón de cada aula.",
         None, False, 10, 3),
        ("Reunión de departamento de Informática",
         "Revisión de la programación de FEM y reparto de empresas colaboradoras para 2º DAW.",
         "Informática", False, 7, 1),
        ("Banco de recursos de Matemáticas",
         "Se ha actualizado la carpeta compartida con fichas de refuerzo para 1º y 2º de ESO.",
         "Matemáticas", False, None, 4),
        ("Semana de la Ciencia",
         "El departamento de Física y Química organiza talleres abiertos del 1 al 5 de diciembre. "
         "Podéis apuntar a vuestros grupos en jefatura.",
         None, False, 15, 5),
        ("Formación en competencia digital docente",
         "Abierto el plazo de inscripción en el curso de competencia digital (nivel B1) del CPR.",
         None, False, 30, 6),
        ("Excursión cancelada (caducado)",
         "Este anuncio caducó y ya no debe aparecer en el tablón.",
         None, False, -1, 9),
    ]
    docs = []
    for titulo, cuerpo, dep, fijado, dias_expira, hace_dias in anuncios:
        docs.append(
            {
                **SEED,
                "titulo": titulo,
                "cuerpo": cuerpo,
                "departamento": dep,
                "fijado": fijado,
                "expira_en": (now() + timedelta(days=dias_expira)) if dias_expira is not None else None,
                "autor_id": str(directiva["_id"]),
                "creado_en": now() - timedelta(days=hace_dias, hours=rng.randint(0, 6)),
            }
        )
    await db["anuncios"].insert_many(docs)
    return len(docs)


async def sembrar_tickets(db: AsyncIOMotorDatabase, usuarios: list[dict[str, Any]]) -> int:
    activos = [u for u in usuarios if u["estado"] == "activo"]
    responsables = [u for u in activos if "responsable_ticket" in u["roles"]]
    tickets = [
        ("rmi", "Proyector del aula B2 no enciende", "El proyector no da imagen desde el lunes. Aula B2, ordenador del profesor.", "abierto"),
        ("rmi", "Ordenadores del Lab. Informática sin red", "Los puestos 7 a 12 no tienen conexión a internet.", "en_proceso"),
        ("rmi", "Pizarra digital descalibrada", "La pizarra del aula A1 no responde bien al lápiz.", "resuelto"),
        ("rmi", "Teclado roto en sala de profesores", "Equipo 3 de la sala de profesores: varias teclas no funcionan.", "cerrado"),
        ("compras", "Kits de robótica para 1º DAW", "4 kits Arduino. Precio total estimado: 180 €. Requiere presupuesto: sí.", "abierto"),
        ("compras", "Material fungible de laboratorio", "Probetas y guantes de nitrilo. Precio total: 95 €. Requiere presupuesto: no.", "en_proceso"),
        ("compras", "Licencias de software de diseño", "10 licencias educativas. Precio total: 0 € (licencia educativa).", "resuelto"),
        ("rrss", "Publicación: Semana de la Ciencia", "Departamento de Física y Química. Talleres abiertos para 2º ESO.", "abierto"),
        ("rrss", "Publicación: visita a empresa de 2º DAW", "Departamento de Informática. Visita a una empresa de desarrollo web.", "en_proceso"),
        ("rrss", "Publicación: concurso de relato corto", "Departamento de Lengua Castellana. Fallo del jurado y premiados.", "cerrado"),
    ]
    comentarios_por_estado = {
        "en_proceso": ["Recibido, lo revisamos esta semana.", "Gracias, quedo a la espera."],
        "resuelto": ["Solucionado. ¿Podéis confirmar que funciona?", "Confirmado, todo correcto."],
        "cerrado": ["Cerrado tras la verificación."],
    }
    n = 0
    for i, (tipo, titulo, descripcion, estado) in enumerate(tickets):
        solicitante = activos[i % len(activos)]
        asignado = responsables[i % len(responsables)] if estado != "abierto" else None
        doc = {
            **SEED,
            "tipo": tipo,
            "titulo": titulo,
            "descripcion": descripcion,
            "estado": estado,
            "solicitante_id": str(solicitante["_id"]),
            "asignado_id": str(asignado["_id"]) if asignado else None,
            "creado_en": now() - timedelta(days=len(tickets) - i, hours=rng.randint(0, 8)),
        }
        result = await db["tickets"].insert_one(doc)
        n += 1
        for j, cuerpo in enumerate(comentarios_por_estado.get(estado, [])):
            autor = asignado if j % 2 == 0 and asignado else solicitante
            await db["ticket_comentarios"].insert_one(
                {
                    **SEED,
                    "ticket_id": str(result.inserted_id),
                    "autor_id": str(autor["_id"]),
                    "cuerpo": cuerpo,
                    "creado_en": doc["creado_en"] + timedelta(hours=4 + j * 6),
                }
            )
    return n


async def sembrar_fem(db: AsyncIOMotorDatabase, tutores: list[dict[str, Any]]) -> int:
    docs = []
    for i in range(15):
        nombre = f"{rng.choice(NOMBRES)} {rng.choice(APELLIDOS)} {rng.choice(APELLIDOS)}"
        estado = rng.choices(["activo", "pendiente", "finalizado"], weights=[7, 2, 2])[0]
        horas = {"activo": rng.randint(40, 460), "pendiente": 0, "finalizado": 500}[estado]
        docs.append(
            {
                **SEED,
                "nombre": nombre,
                "empresa": rng.choice(EMPRESAS) if estado != "pendiente" else None,
                "estado": estado,
                "horas_cursadas": horas,
                "horas_totales": 500,
                "tutor_id": str(tutores[i % len(tutores)]["_id"]),
                "creado_en": now(),
            }
        )
    await db["fem_alumnos"].insert_many(docs)
    return len(docs)


async def sembrar_alumnos_y_retrasos(
    db: AsyncIOMotorDatabase, docentes: list[dict[str, Any]]
) -> tuple[int, int]:
    alumnos: list[dict[str, Any]] = []
    usados: set[str] = set()
    for grupo, (curso, _) in GRUPOS.items():
        for _ in range(10):
            while True:
                nombre = f"{rng.choice(NOMBRES)} {rng.choice(APELLIDOS)} {rng.choice(APELLIDOS)}"
                if nombre not in usados:
                    usados.add(nombre)
                    break
            alumnos.append({**SEED, "nombre": nombre, "grupo": grupo, "curso": curso})
    result = await db["alumnos"].insert_many(alumnos)
    for doc, oid in zip(alumnos, result.inserted_ids, strict=True):
        doc["_id"] = oid

    hoy = date.today()
    inicio_curso = date(hoy.year if hoy.month >= 9 else hoy.year - 1, 9, 15)
    dias_curso = max((hoy - inicio_curso).days, 1)
    retrasos: list[dict[str, Any]] = []
    vistos: set[tuple[str, str, str, str]] = set()
    # Unos pocos alumnos acumulan varios retrasos (útil para el umbral de dirección).
    for alumno in rng.sample(alumnos, 18):
        for _ in range(rng.choice([1, 1, 2, 3, 5])):
            fecha = inicio_curso + timedelta(days=rng.randint(0, dias_curso))
            if fecha.weekday() >= 5:
                fecha -= timedelta(days=fecha.weekday() - 4)
            hora = rng.choice(["08:20", "08:25", "08:30", "09:15", "11:35"])
            modulo = rng.choice(GRUPOS[alumno["grupo"]][1])
            clave = (str(alumno["_id"]), fecha.isoformat(), hora, modulo)
            if clave in vistos:
                continue
            vistos.add(clave)
            retrasos.append(
                {
                    **SEED,
                    "alumno_id": str(alumno["_id"]),
                    "fecha": fecha.isoformat(),
                    "hora": hora,
                    "modulo": modulo,
                    "grupo": alumno["grupo"],
                    "curso_escolar": curso_escolar_de(fecha),
                    "registrado_por_id": str(rng.choice(docentes)["_id"]),
                    "creado_en": datetime.combine(fecha, datetime.min.time(), UTC) + timedelta(hours=9),
                }
            )
    if retrasos:
        await db["retrasos"].insert_many(retrasos)
    return len(alumnos), len(retrasos)


async def main(admin_email: str | None) -> None:
    settings = get_settings()
    if settings.environment != "development":
        raise SystemExit("seed_demo solo puede ejecutarse con ENVIRONMENT=development")

    client: AsyncIOMotorClient = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db]
    try:
        await limpiar(db)
        usuarios = await sembrar_usuarios(db)
        activos = [u for u in usuarios if u["estado"] == "activo"]
        tutores = [u for u in activos if "tutor" in u["roles"]]
        docentes = [u for u in activos if "docente" in u["roles"]]

        if admin_email:
            admin = await preparar_admin(db, admin_email)
            tutores = [admin, *tutores]
            activos = [admin, *activos]
            print(f"Cuenta {admin['email']} activa como admin, docente y tutor (id {ObjectId(admin['_id'])}).")

        n_anuncios = await sembrar_anuncios(db, usuarios)
        n_tickets = await sembrar_tickets(db, activos)
        n_fem = await sembrar_fem(db, tutores)
        n_alumnos, n_retrasos = await sembrar_alumnos_y_retrasos(db, docentes)
        print(
            "Seed completado en "
            f"'{settings.mongodb_db}': {len(usuarios)} usuarios, {n_anuncios} anuncios, "
            f"{n_tickets} tickets, {n_fem} alumnos FEM, {n_alumnos} alumnos, {n_retrasos} retrasos."
        )
    finally:
        client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Datos de demostración ficticios (solo desarrollo).")
    parser.add_argument(
        "--admin-email",
        help="Email de tu cuenta Google: se activa como admin + docente + tutor.",
    )
    args = parser.parse_args()
    asyncio.run(main(args.admin_email))
