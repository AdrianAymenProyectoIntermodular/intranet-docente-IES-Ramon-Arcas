"""Esquemas de alumnado (fuente propia de la intranet para retrasos)."""

from typing import Any

from pydantic import BaseModel


class Alumno(BaseModel):
    """Datos mínimos del alumno: solo lo necesario para identificarlo en el aula."""

    id: str
    nombre: str
    grupo: str
    curso: str


def doc_to_alumno(doc: dict[str, Any]) -> Alumno:
    return Alumno(
        id=str(doc["_id"]),
        nombre=doc["nombre"],
        grupo=doc.get("grupo", ""),
        curso=doc.get("curso", ""),
    )
