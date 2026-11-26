"""Proveedores de generación de borradores RRSS.

Para conectar un modelo real:
1. Crear `app/services/ia/<proveedor>.py` con una clase que cumpla `GeneradorBorrador`
   (usar `settings.ia_api_key` y `settings.ia_modelo`; lanzar `ErrorGeneracion` si falla).
2. Registrarla en `PROVEEDORES`.
3. Poner `IA_PROVEEDOR=<proveedor>` en `backend/.env`.
"""

from collections.abc import Callable

from app.core.config import get_settings
from app.services.ia.base import Borrador, EntradaBorrador, ErrorGeneracion, GeneradorBorrador
from app.services.ia.plantilla import GeneradorPlantilla

PROVEEDORES: dict[str, Callable[[], GeneradorBorrador]] = {
    "plantilla": GeneradorPlantilla,
}


def obtener_generador() -> GeneradorBorrador:
    nombre = (get_settings().ia_proveedor or "plantilla").strip().lower()
    fabrica = PROVEEDORES.get(nombre)
    if fabrica is None:
        raise ErrorGeneracion(f"Proveedor de IA desconocido: {nombre}")
    return fabrica()


__all__ = ["Borrador", "EntradaBorrador", "ErrorGeneracion", "GeneradorBorrador", "obtener_generador"]
