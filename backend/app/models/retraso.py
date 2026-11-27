"""Esquemas de retrasos del alumnado."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RetrasoCreate(BaseModel):
    """El autor no viaja en el cuerpo: se toma del JWT."""

    model_config = ConfigDict(extra="forbid")

    alumno_id: str
    fecha: date
    hora: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$", examples=["08:20"])
    modulo: str = Field(min_length=1)


class Retraso(BaseModel):
    id: str
    alumno_id: str
    fecha: date
    hora: str
    modulo: str
    grupo: str | None = None
    curso_escolar: str
    registrado_por_id: str
    creado_en: datetime | None = None


class RetrasoPaginated(BaseModel):
    items: list[Retraso]
    page: int
    limit: int
    total: int


def doc_to_retraso(doc: dict[str, Any]) -> Retraso:
    return Retraso(
        id=str(doc["_id"]),
        alumno_id=doc["alumno_id"],
        fecha=date.fromisoformat(doc["fecha"]),
        hora=doc["hora"],
        modulo=doc["modulo"],
        grupo=doc.get("grupo"),
        curso_escolar=doc["curso_escolar"],
        registrado_por_id=doc["registrado_por_id"],
        creado_en=doc.get("creado_en"),
    )
