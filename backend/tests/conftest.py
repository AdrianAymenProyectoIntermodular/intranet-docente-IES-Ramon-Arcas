"""Configuración común de pytest.

Los tests vacían colecciones (``delete_many``) y claves de Redis, así que NUNCA deben usar la base
de datos de desarrollo. Aquí se fuerza una base de datos y un índice de Redis exclusivos de test,
aunque el entorno (p. ej. el contenedor del backend con ``backend/.env``) apunte a los reales.
Se ejecuta antes de importar los módulos de test, así que gana a sus ``os.environ.setdefault``.
"""

import os
import re

# Base de datos de test (configurable con TEST_MONGODB_DB, pero siempre con sufijo _test).
_db_test = os.environ.get("TEST_MONGODB_DB", "intranet_docente_test")
if not _db_test.endswith("_test"):
    raise RuntimeError(f"TEST_MONGODB_DB={_db_test!r} debe terminar en '_test' para no borrar datos reales")
os.environ["MONGODB_DB"] = _db_test

# Mismo servidor Redis, pero en el índice 1 (la aplicación usa el 0).
_redis = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
os.environ["REDIS_URL"] = re.sub(r"/\d+$", "", _redis) + "/1"
