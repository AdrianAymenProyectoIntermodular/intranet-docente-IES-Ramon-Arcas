"""Contrato común de los generadores de borradores para redes sociales.

Cualquier proveedor (la plantilla temporal o un modelo de IA real) implementa
`GeneradorBorrador.generar`. El resto de la aplicación no sabe cuál se usa.
"""

from dataclasses import dataclass, field
from typing import Protocol


@dataclass(frozen=True)
class EntradaBorrador:
    """Lo que escribió el docente en la solicitud; es la única fuente de hechos."""

    titulo: str
    departamento: str
    descripcion: str
    imagenes: list[str] = field(default_factory=list)  # nombres de archivo adjuntos


@dataclass(frozen=True)
class Borrador:
    texto: str
    proveedor: str
    modelo: str | None = None


class ErrorGeneracion(Exception):
    """El proveedor no pudo generar el borrador (sin clave, caído, respuesta inválida…)."""


class GeneradorBorrador(Protocol):
    nombre: str

    async def generar(self, entrada: EntradaBorrador) -> Borrador: ...
