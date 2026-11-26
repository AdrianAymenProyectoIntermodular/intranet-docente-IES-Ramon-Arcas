"""Generador temporal sin IA: ordena en una plantilla lo que escribió el docente.

Sustituye al modelo real mientras se decide el proveedor (indicación del profesorado).
No inventa hechos: todo el contenido sale de la solicitud, salvo el pie fijo del centro.
"""

import re
import unicodedata

from app.services.ia.base import Borrador, EntradaBorrador

NOMBRE = "plantilla"
CENTRO = "IES Ramón Arcas Meca"
HASHTAGS_CENTRO = ["#IESRamonArcas", "#Lorca"]


def hashtag(texto: str) -> str:
    """'Física y Química' → '#FisicaYQuimica' (sin tildes ni espacios)."""
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    palabras = re.findall(r"[A-Za-z0-9]+", sin_tildes)
    return "#" + "".join(p[:1].upper() + p[1:] for p in palabras) if palabras else ""


class GeneradorPlantilla:
    nombre = NOMBRE

    async def generar(self, entrada: EntradaBorrador) -> Borrador:
        titulo = entrada.titulo.strip()
        descripcion = entrada.descripcion.strip()
        partes = [titulo]
        if descripcion:
            partes.append(descripcion)
        if entrada.departamento:
            partes.append(f"Una actividad del departamento de {entrada.departamento} del {CENTRO}.")
        etiquetas = [*HASHTAGS_CENTRO]
        if (h := hashtag(entrada.departamento)) and h not in etiquetas:
            etiquetas.append(h)
        partes.append(" ".join(etiquetas))
        return Borrador(texto="\n\n".join(partes), proveedor=NOMBRE)
