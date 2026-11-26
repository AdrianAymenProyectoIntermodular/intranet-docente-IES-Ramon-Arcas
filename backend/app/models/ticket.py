"""Esquemas de tickets y comentarios."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


class TicketTipo(str, Enum):
    rmi = "rmi"
    rrss = "rrss"
    compras = "compras"
    otro = "otro"


class TicketEstado(str, Enum):
    abierto = "abierto"
    en_proceso = "en_proceso"
    resuelto = "resuelto"
    cerrado = "cerrado"


# Transiciones válidas: abierto → en_proceso → resuelto → cerrado
TRANSICIONES_VALIDAS: dict[TicketEstado, set[TicketEstado]] = {
    TicketEstado.abierto: {TicketEstado.en_proceso},
    TicketEstado.en_proceso: {TicketEstado.resuelto},
    TicketEstado.resuelto: {TicketEstado.cerrado},
    TicketEstado.cerrado: set(),
}


class DatosRmi(BaseModel):
    """Incidencia RMI: dónde y qué equipos fallan."""

    model_config = ConfigDict(extra="forbid")

    aula: str = Field(min_length=1, max_length=60)
    dispositivos: str = Field(min_length=1, max_length=200)


class DatosCompras(BaseModel):
    """Gestión de compras: artículos, importe y si requiere presupuesto."""

    model_config = ConfigDict(extra="forbid")

    articulos: str = Field(min_length=1, max_length=2000)
    precio_total: float = Field(ge=0, le=100_000)
    requiere_presupuesto: bool = False


class DatosRrss(BaseModel):
    """Publicación en RRSS: departamento responsable de la actividad."""

    model_config = ConfigDict(extra="forbid")

    departamento: str = Field(min_length=1, max_length=80)


class DatosOtro(BaseModel):
    model_config = ConfigDict(extra="forbid")


# Campo flexible `datos` validado según el tipo de solicitud (memoria, apartado 5.7).
DATOS_POR_TIPO: dict[TicketTipo, type[BaseModel]] = {
    TicketTipo.rmi: DatosRmi,
    TicketTipo.compras: DatosCompras,
    TicketTipo.rrss: DatosRrss,
    TicketTipo.otro: DatosOtro,
}


class Ticket(BaseModel):
    id: str
    tipo: TicketTipo
    estado: TicketEstado
    titulo: str
    descripcion: str | None = None
    solicitante_id: str
    asignado_id: str | None = None
    creado_en: datetime | None = None
    datos: dict[str, Any] = Field(default_factory=dict)


class TicketCreate(BaseModel):
    tipo: TicketTipo
    titulo: str = Field(min_length=1, max_length=140)
    descripcion: str | None = Field(default=None, max_length=4000)
    datos: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validar_datos(self) -> "TicketCreate":
        """Valida y normaliza `datos` con el esquema de su tipo (422 si no cuadra)."""
        modelo = DATOS_POR_TIPO[self.tipo]
        try:
            self.datos = modelo.model_validate(self.datos).model_dump()
        except ValidationError as exc:
            errores = "; ".join(
                f"{'.'.join(str(p) for p in e['loc']) or 'datos'}: {e['msg']}" for e in exc.errors()
            )
            raise ValueError(f"datos no válidos para el tipo {self.tipo.value}: {errores}") from exc
        return self


class TicketPatch(BaseModel):
    estado: TicketEstado | None = None
    asignado_id: str | None = None


class Comentario(BaseModel):
    id: str
    autor_id: str
    cuerpo: str
    creado_en: datetime
    ticket_id: str | None = None


class ComentarioCreate(BaseModel):
    cuerpo: str = Field(min_length=1)


def doc_to_ticket(doc: dict[str, Any]) -> Ticket:
    return Ticket(
        id=str(doc["_id"]),
        tipo=TicketTipo(doc["tipo"]),
        estado=TicketEstado(doc["estado"]),
        titulo=doc["titulo"],
        descripcion=doc.get("descripcion"),
        solicitante_id=doc["solicitante_id"],
        asignado_id=doc.get("asignado_id"),
        creado_en=doc.get("creado_en"),
        datos=doc.get("datos") or {},
    )


def doc_to_comentario(doc: dict[str, Any]) -> Comentario:
    return Comentario(
        id=str(doc["_id"]),
        autor_id=doc["autor_id"],
        cuerpo=doc["cuerpo"],
        creado_en=doc["creado_en"],
        ticket_id=doc.get("ticket_id"),
    )
