"""Geocodificación de direcciones de empresas con Nominatim (OpenStreetMap).

Política de uso de Nominatim: como máximo 1 petición por segundo, User-Agent que
identifique la aplicación y sin uso masivo. Solo se envía la dirección de la
empresa, nunca datos de personas.
"""

import asyncio
import logging
import time

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)

USER_AGENT = "IntranetDocente/0.1 (proyecto educativo)"
_lock = asyncio.Lock()
_ultima = 0.0


async def geocodificar(direccion: str, municipio: str) -> tuple[float, float] | None:
    """Devuelve (lat, lon) o None si no se encuentra o el servicio no responde."""
    settings = get_settings()
    if not settings.geocodificacion_activa:
        return None
    global _ultima
    async with _lock:
        espera = 1.0 - (time.monotonic() - _ultima)
        if espera > 0:
            await asyncio.sleep(espera)
        try:
            async with httpx.AsyncClient(timeout=8.0, headers={"User-Agent": USER_AGENT}) as client:
                res = await client.get(
                    settings.nominatim_url,
                    params={
                        "q": f"{direccion}, {municipio}, Región de Murcia, España",
                        "format": "jsonv2",
                        "limit": 1,
                        "countrycodes": "es",
                    },
                )
                res.raise_for_status()
                datos = res.json()
        except (httpx.HTTPError, ValueError):
            logger.warning("Nominatim no respondió para %s, %s", direccion, municipio, exc_info=True)
            return None
        finally:
            _ultima = time.monotonic()
    if not datos:
        return None
    try:
        return float(datos[0]["lat"]), float(datos[0]["lon"])
    except (KeyError, TypeError, ValueError):
        return None
