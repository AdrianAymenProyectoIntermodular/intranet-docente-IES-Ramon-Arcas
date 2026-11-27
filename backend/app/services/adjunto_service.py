"""Adjuntos de tickets: validación estricta y almacenamiento en GridFS (MongoDB).

Reglas (01-api-security): se valida tamaño, extensión, tipo MIME declarado y la firma
real del archivo (bytes mágicos), para no confiar en lo que dice el cliente.
"""

import os
import re
from dataclasses import dataclass

from bson import ObjectId
from fastapi import HTTPException, UploadFile, status
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket

from app.models.ticket import AdjuntoMeta, Ticket, TicketTipo
from app.models.usuario import utcnow

BUCKET = "adjuntos"
MAX_BYTES = 5 * 1024 * 1024
MAX_POR_TICKET = 10


@dataclass(frozen=True)
class Formato:
    extensiones: tuple[str, ...]
    mime: str


FORMATOS: dict[str, Formato] = {
    "jpg": Formato((".jpg", ".jpeg"), "image/jpeg"),
    "png": Formato((".png",), "image/png"),
    "webp": Formato((".webp",), "image/webp"),
    "pdf": Formato((".pdf",), "application/pdf"),
}

# RRSS: solo imágenes para publicar; compras: presupuesto en PDF o foto.
PERMITIDOS: dict[TicketTipo, tuple[str, ...]] = {
    TicketTipo.rrss: ("jpg", "png", "webp"),
    TicketTipo.compras: ("pdf", "jpg", "png"),
    TicketTipo.rmi: ("jpg", "png", "webp"),
    TicketTipo.otro: ("pdf", "jpg", "png", "webp"),
}


def detectar_formato(datos: bytes) -> str | None:
    """Formato real según la cabecera binaria del archivo."""
    if datos.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if datos.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(datos) >= 12 and datos[:4] == b"RIFF" and datos[8:12] == b"WEBP":
        return "webp"
    if datos.startswith(b"%PDF-"):
        return "pdf"
    return None


def nombre_seguro(nombre: str | None) -> str:
    """Solo el nombre base, sin rutas ni caracteres de control, y acotado."""
    base = os.path.basename((nombre or "").replace("\\", "/")).strip()
    base = re.sub(r"[\x00-\x1f\x7f]", "", base)
    return base[:120] or "archivo"


def _bucket(db: AsyncIOMotorDatabase) -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(db, bucket_name=BUCKET)


async def subir(
    db: AsyncIOMotorDatabase,
    ticket: Ticket,
    archivo: UploadFile,
    *,
    usuario_id: str,
) -> AdjuntoMeta:
    if len(ticket.adjuntos) >= MAX_POR_TICKET:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La solicitud ya tiene el máximo de {MAX_POR_TICKET} adjuntos",
        )

    datos = await archivo.read(MAX_BYTES + 1)
    if len(datos) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="El archivo supera el tamaño máximo de 5 MB",
        )
    if not datos:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El archivo está vacío")

    nombre = nombre_seguro(archivo.filename)
    permitidos = PERMITIDOS[ticket.tipo]
    real = detectar_formato(datos)
    extension = os.path.splitext(nombre)[1].lower()
    declarado = (archivo.content_type or "").split(";")[0].strip().lower()
    valido = (
        real in permitidos
        and extension in FORMATOS[real].extensiones
        and declarado in (FORMATOS[real].mime, "application/octet-stream", "")
    )
    if not valido:
        legibles = ", ".join(f.upper() for f in permitidos)
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Tipo de archivo no permitido para esta solicitud. Formatos admitidos: {legibles}",
        )

    mime = FORMATOS[real].mime
    file_id = await _bucket(db).upload_from_stream(
        nombre,
        datos,
        metadata={"ticket_id": ticket.id, "subido_por_id": usuario_id, "content_type": mime},
    )
    meta = AdjuntoMeta(
        id=str(file_id),
        nombre=nombre,
        tipo_mime=mime,
        tamano=len(datos),
        subido_por_id=usuario_id,
        subido_en=utcnow(),
    )
    # Condición atómica para no superar el máximo con subidas simultáneas.
    result = await db["tickets"].update_one(
        {"_id": ObjectId(ticket.id), f"adjuntos.{MAX_POR_TICKET - 1}": {"$exists": False}},
        {"$push": {"adjuntos": meta.model_dump()}},
    )
    if result.modified_count == 0:
        await _bucket(db).delete(file_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La solicitud ya tiene el máximo de {MAX_POR_TICKET} adjuntos",
        )
    return meta


def buscar(ticket: Ticket, adjunto_id: str) -> AdjuntoMeta:
    meta = next((a for a in ticket.adjuntos if a.id == adjunto_id), None)
    if meta is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adjunto no encontrado")
    return meta


async def leer(db: AsyncIOMotorDatabase, meta: AdjuntoMeta) -> bytes:
    stream = await _bucket(db).open_download_stream(ObjectId(meta.id))
    return await stream.read()


async def borrar(db: AsyncIOMotorDatabase, ticket: Ticket, meta: AdjuntoMeta) -> None:
    await db["tickets"].update_one({"_id": ObjectId(ticket.id)}, {"$pull": {"adjuntos": {"id": meta.id}}})
    await _bucket(db).delete(ObjectId(meta.id))
