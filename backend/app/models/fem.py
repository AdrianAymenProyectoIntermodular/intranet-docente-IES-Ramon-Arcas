"""Esquemas FEM (Formación en Empresas Murcia): alumnado en prácticas y empresas colaboradoras."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FemAlumno(BaseModel):
    id: str
    nombre: str
    empresa: str | None = None
    empresa_id: str | None = None
    ciclo: str | None = None
    estado: str | None = None
    horas_cursadas: float = 0
    horas_totales: float = 500
    tutor_id: str | None = None
    tutor_nombre: str | None = None


class FemHorasPatch(BaseModel):
    horas_cursadas: float = Field(ge=0, le=500)


class EmpresaCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: str = Field(min_length=1, max_length=120)
    direccion: str = Field(min_length=1, max_length=200)
    municipio: str = Field(min_length=1, max_length=80)
    ciclos: list[str] = Field(default_factory=list, max_length=20)
    activa: bool = True


class EmpresaPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    direccion: str | None = Field(default=None, min_length=1, max_length=200)
    municipio: str | None = Field(default=None, min_length=1, max_length=80)
    ciclos: list[str] | None = Field(default=None, max_length=20)
    activa: bool | None = None


class Empresa(BaseModel):
    id: str
    nombre: str
    direccion: str
    municipio: str
    ciclos: list[str] = Field(default_factory=list)
    activa: bool = True
    lat: float | None = None
    lon: float | None = None
    # False si la dirección no se pudo situar en el mapa (se puede reintentar).
    geocodificada: bool = False
    alumnos: int = 0


def doc_to_fem_alumno(doc: dict[str, Any]) -> FemAlumno:
    return FemAlumno(
        id=str(doc["_id"]),
        nombre=doc["nombre"],
        empresa=doc.get("empresa"),
        empresa_id=doc.get("empresa_id"),
        ciclo=doc.get("ciclo"),
        estado=doc.get("estado"),
        horas_cursadas=float(doc.get("horas_cursadas", 0)),
        horas_totales=float(doc.get("horas_totales", 500)),
        tutor_id=doc.get("tutor_id"),
    )


def doc_to_empresa(doc: dict[str, Any], alumnos: int = 0) -> Empresa:
    return Empresa(
        id=str(doc["_id"]),
        nombre=doc["nombre"],
        direccion=doc["direccion"],
        municipio=doc["municipio"],
        ciclos=list(doc.get("ciclos", [])),
        activa=bool(doc.get("activa", True)),
        lat=doc.get("lat"),
        lon=doc.get("lon"),
        geocodificada=doc.get("lat") is not None and doc.get("lon") is not None,
        alumnos=alumnos,
    )
