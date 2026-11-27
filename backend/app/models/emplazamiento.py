"""Emplazamiento del alumnado en el aula: diseños de pupitres asociados a una clase."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

MAX_LADO = 10


class Distribucion(str, Enum):
    filas = "filas"
    parejas = "parejas"
    grupos = "grupos"
    u = "u"
    personalizada = "personalizada"


class Puesto(BaseModel):
    """Un pupitre de la rejilla; las celdas sin puesto son pasillo."""

    model_config = ConfigDict(extra="forbid")

    fila: int = Field(ge=0, lt=MAX_LADO)
    columna: int = Field(ge=0, lt=MAX_LADO)
    alumno_id: str | None = None
    equipo: str | None = Field(default=None, max_length=20)


class EmplazamientoBase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=80)
    grupo: str = Field(min_length=1, max_length=20)
    modulo: str = Field(min_length=1, max_length=80)
    distribucion: Distribucion
    filas: int = Field(ge=1, le=MAX_LADO)
    columnas: int = Field(ge=1, le=MAX_LADO)
    puestos: list[Puesto] = Field(default_factory=list, max_length=MAX_LADO * MAX_LADO)


class EmplazamientoCreate(EmplazamientoBase):
    pass


class Emplazamiento(EmplazamientoBase):
    model_config = ConfigDict(extra="ignore")

    id: str
    autor_id: str
    autor_nombre: str | None = None
    creado_en: datetime | None = None
    actualizado_en: datetime | None = None


def doc_to_emplazamiento(doc: dict[str, Any]) -> Emplazamiento:
    return Emplazamiento(
        id=str(doc["_id"]),
        nombre=doc["nombre"],
        grupo=doc["grupo"],
        modulo=doc["modulo"],
        distribucion=Distribucion(doc["distribucion"]),
        filas=doc["filas"],
        columnas=doc["columnas"],
        puestos=[Puesto(**p) for p in doc.get("puestos", [])],
        autor_id=doc["autor_id"],
        creado_en=doc.get("creado_en"),
        actualizado_en=doc.get("actualizado_en"),
    )
