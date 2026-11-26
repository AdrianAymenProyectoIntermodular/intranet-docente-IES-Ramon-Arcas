# Contrato API — Intranet Docente

Fuente canónica machine-readable: [openapi/openapi.yaml](../openapi/openapi.yaml).

Prefijo funcional: **`/api/v1`**.  
Health: sin prefijo de versión (`/health`, `/health/ready`).

Autenticación por defecto: header `Authorization: Bearer <access_token>`, salvo endpoints públicos y refresh (cookie).

## Convenciones de respuesta (norma del repo)

Alineadas a los apuntes del profesorado (FastAPI + diseño REST):

| Caso | Formato |
|------|--------|
| Error | `{"detail": "..."}` o lista de errores de validación 422 |
| Listados paginados | `{ "items": [...], "page": 1, "limit": 10, "total": N }` |
| Listados filtrados (excepción) | Array JSON directo — ver [Excepciones de paginación](#excepciones-de-paginación) |
| Detalle / recurso | Objeto JSON del recurso |
| POST creado | `201` + cuerpo del recurso + cabecera `Location: /api/v1/.../{id}` |
| Mutación OK | Recurso actualizado (sin wrapper `{code, msg}`) |

Códigos habituales: `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `503`.

Paginación (cuando aplica): `page` (default 1), `limit` (default 10, máx. 50).

Identificadores: `string` (ObjectId de MongoDB en hex). El cliente **nunca** envía el `id` en el alta; lo asigna el servidor.

Nombres del personal: junto a cada referencia a una cuenta (`solicitante_id`, `asignado_id`, `autor_id`, `tutor_id`) la respuesta incluye `*_nombre`, resuelto por el servidor y de solo lectura. Evita que el cliente tenga que consultar `/usuarios/{id}` (reservado a admin o al propio usuario).

### Excepciones de paginación

Estos listados devuelven un **array** (no el wrapper paginado), porque se consultan por filtro acotado:

| Endpoint | Motivo |
|----------|--------|
| `GET /api/v1/anuncios` | Feed del tablón (vigentes, segmentados) |
| `GET /api/v1/tickets` | Cola filtrada por `tipo` / `estado` |
| `GET /api/v1/guardias` | Cuadrante por `fecha` / `franja` |
| `POST /api/v1/guardias/asignar` | Resultado de la ejecución (array de `Guardia`) |
| `GET /api/v1/alumnos` | Selector acotado (máx. 50) por `grupo` / `q` |
| `GET /api/v1/emplazamientos` | Diseños de una clase (máx. 100) |

Usuarios, retrasos, notificaciones y auditoría sí usan `{ items, page, limit, total }`.

## Auth

| Método | Endpoint | Auth | Roles | Descripción |
|--------|----------|------|-------|-------------|
| POST | `/api/v1/auth/google` | Público | — | Body `{ "id_token" }` → access JWT + cookie HttpOnly refresh |
| POST | `/api/v1/auth/refresh` | Cookie refresh | — | Renueva access; no usa Bearer |
| POST | `/api/v1/auth/logout` | Auth | — | Invalida refresh en Redis y borra cookie |
| GET | `/api/v1/auth/me` | Auth | — | Usuario autenticado, roles y estado |

- Access token: header Bearer.
- Refresh token: cookie HttpOnly `refresh_token` (path `/api/v1/auth`), almacenada en Redis.
- Sin restricción de dominio Google. Alta OAuth deja al usuario en estado `pendiente` hasta aprobación admin.

## Usuarios

| Método | Endpoint | Auth | Roles / regla | Descripción |
|--------|----------|------|---------------|-------------|
| GET | `/api/v1/usuarios` | Auth | `admin` | Listado paginado (`?departamento=&estado=&rol=&page=&limit=`) |
| POST | `/api/v1/usuarios` | Auth | `admin` | Alta manual; `201` + `Location` |
| GET | `/api/v1/usuarios/me` | Auth | — | Perfil propio |
| PATCH | `/api/v1/usuarios/me` | Auth | — | Rectificar datos propios (RGPD): `name`, `dni`, `telefono` |
| GET | `/api/v1/usuarios/me/datos` | Auth | — | Exportar datos personales propios (RGPD) |
| GET | `/api/v1/usuarios/me/horario` | Auth | — | Horario semanal propio |
| GET | `/api/v1/usuarios/{id}` | Auth | `admin` o propio | Detalle |
| GET | `/api/v1/usuarios/{id}/horario` | Auth | `admin` o propio | Horario de un docente |
| PATCH | `/api/v1/usuarios/{id}` | Auth | `admin` | Parcial (aprobar, roles, departamento…) |
| PUT | `/api/v1/usuarios/{id}/roles` | Auth | `admin` | Sustituir lista de roles; `409` si se elimina el último admin |

## Anuncios

| Método | Endpoint | Auth | Roles | Descripción |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/anuncios` | Auth | — | Feed segmentado por departamento (array) |
| POST | `/api/v1/anuncios` | Auth | `admin`, `directiva` | Publicar; `201` + `Location` |
| PATCH | `/api/v1/anuncios/{id}/fijar` | Auth | `admin` | Fijar / desfijar |

## Guardias

| Método | Endpoint | Auth | Roles | Descripción |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/guardias` | Auth | — | Cuadrante (`?fecha=&franja=`) → array |
| POST | `/api/v1/guardias/asignar` | Auth | `jefatura` | Asignación por rondas → array de `Guardia` |
| PATCH | `/api/v1/guardias/{id}` | Auth | `jefatura` | Cambiar `cubre_id` / estado → `Guardia` |

### Modelo y regla de asignación

Cada `Guardia` distingue:

| Campo | Significado |
|-------|-------------|
| `asignado_id` | Docente al que corresponde la guardia por ronda/contador |
| `cubre_id` | Docente que finalmente realiza la guardia |
| `ausente_id` | Docente cuya ausencia genera el hueco |

Regla (cerrada; runtime en Fase 3):

1. En cada hueco puede haber más de un docente disponible.
2. Contador de guardias realizadas **por docente y por hueco horario concreto**.
3. Empate en contador entre disponibles del hueco → selección aleatoria.
4. La comparación del contador es solo entre disponibles de ese hueco, nunca contra todo el claustro.
5. Si el `asignado_id` no puede asistir, otro disponible cubre (`cubre_id`); en rondas siguientes se prioriza a quien tenga menos.
6. `asignado_id` y `cubre_id` pueden diferir.

## Ausencias

| Método | Endpoint | Auth | Roles / propiedad | Descripción |
|--------|----------|------|-------------------|-------------|
| POST | `/api/v1/ausencias` | Auth | — | Registro; `201` + cuerpo `Ausencia` + `Location` |
| GET | `/api/v1/ausencias/{id}` | Auth | dueño / `admin` / `jefatura` | Detalle |
| POST | `/api/v1/ausencias/{id}/justificante` | Auth | dueño | Subida de justificante |
| GET | `/api/v1/ausencias/{id}/pdf` | Auth | dueño | PDF autocompletado |
| POST | `/api/v1/ausencias/{id}/firma` | Auth | dueño | Firma; body `FirmaRequest` → `Ausencia` |

### Firma (decisión cerrada)

| Campo | Valor |
|-------|--------|
| `proveedor` | `manuscrita` (objetivo garantizado) o `autofirma` (mejor esfuerzo) |
| `firma_base64` | Imagen PNG/JPEG en base64 (captura en pantalla o payload del cliente) |

AutoFirma depende de certificado e instalación en el equipo del usuario; no bloquea la evaluación si la vía manuscrita funciona.

Estados de ausencia: `registrada` → `pendiente_justificante` (si genérica) → `pendiente_firma` → `firmada`.

## Tickets

| Método | Endpoint | Auth | Roles / propiedad | Descripción |
|--------|----------|------|-------------------|-------------|
| GET | `/api/v1/tickets` | Auth | — | Listado (`?tipo=&estado=`) → array |
| POST | `/api/v1/tickets` | Auth | — | Creación; `201` + `Location` |
| PATCH | `/api/v1/tickets/{id}` | Auth | `admin` / `responsable_ticket` con competencia en el tipo | Transición de estado y asignación |
| POST | `/api/v1/tickets/{id}/borrador` | Auth | solicitante, asignado, `admin` | Regenerar borrador de publicación RRSS |
| POST | `/api/v1/tickets/{id}/adjuntos` | Auth | solicitante, asignado, `admin` | Subir archivo (multipart `archivo`); `201` + `Location` |
| GET | `/api/v1/tickets/{id}/adjuntos/{adjunto_id}` | Auth | involucrados | Descargar adjunto |
| DELETE | `/api/v1/tickets/{id}/adjuntos/{adjunto_id}` | Auth | quien lo subió, `admin` | Borrar adjunto (`204`) |
| GET | `/api/v1/tickets/{id}/comentarios` | Auth | involucrados | Hilo de comentarios |
| POST | `/api/v1/tickets/{id}/comentarios` | Auth | involucrados | Nuevo comentario; `201` + `Location` |

### Máquina de estados de tickets

```
abierto → en_proceso → resuelto → cerrado
```

- Solo se aceptan transiciones válidas.
- Transición inválida → `422` con `{"detail": "..."}`.

### Datos por tipo (`datos`)

Campo flexible validado según `tipo` (memoria, apartado 5.7). Campos no previstos → `422`.

| Tipo | Campos |
|------|--------|
| `rmi` | `aula`, `dispositivos` |
| `compras` | `articulos`, `precio_total` (≥ 0), `requiere_presupuesto` (bool) |
| `rrss` | `departamento` |
| `otro` | sin datos |

### Borrador de publicaciones RRSS

- Los tickets `rrss` tienen `borrador` (`estado`: `pendiente` → `listo` | `error`, `texto`, `proveedor`). Se genera en segundo plano al crear y se puede regenerar.
- El proveedor se elige con `IA_PROVEEDOR` en `backend/.env`. Hoy solo existe `plantilla`: **generador temporal sin IA** (indicación del profesorado) que ordena lo escrito por el docente sin inventar datos. La interfaz lo identifica como plantilla.
- Conectar un modelo real: nuevo módulo en `app/services/ia/` que cumpla `GeneradorBorrador`, registrarlo en `PROVEEDORES` y configurar `IA_PROVEEDOR`, `IA_API_KEY`, `IA_MODELO`. El contrato no cambia.
- Nada se publica automáticamente en redes.

### Adjuntos

- Almacenados en GridFS (MongoDB); el ticket guarda sus metadatos en `adjuntos`.
- Máximo **5 MB** por archivo (`413`) y **10** por solicitud (`409`).
- Se comprueban extensión, MIME declarado y bytes mágicos (`415` si no cuadran): `rrss` y `rmi` → JPG/PNG/WEBP; `compras` → PDF/JPG/PNG; `otro` → PDF/JPG/PNG/WEBP.
- Auditoría: `tickets.adjunto_create`, `tickets.adjunto_delete`.

### Asignación por tipo (competencias)

- Cada usuario tiene `competencias`: los tipos de solicitud que gestiona (`rmi`, `compras`, `rrss`, `otro`). Solo cuentan si tiene el rol `responsable_ticket`; las edita `admin` con `PATCH /usuarios/{id}` (auditado).
- Al crear un ticket se asigna automáticamente al responsable activo con competencia en su tipo y **menos solicitudes abiertas** (empate: orden alfabético). Sin responsables del tipo, queda sin asignar.
- Gestionan: `admin` siempre; un `responsable_ticket` solo tickets de su competencia que tenga asignados o estén libres.
- Reasignar a otra persona es de `admin`; el destino debe ser responsable activo con la competencia (si no, `422`).

## FEM (Formación en Empresas Murcia)

| Método | Endpoint | Auth | Roles | Descripción |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/fem/alumnos` | Auth | `tutor`, `admin` | Alumnado asignado |
| PATCH | `/api/v1/fem/alumnos/{id}/horas` | Auth | `tutor`, `admin` | Actualizar horas cursadas |
| GET | `/api/v1/fem/empresas` | Auth | `tutor`, `admin`, `directiva` | Empresas con ubicación (`?municipio=&ciclo=&activa=`) → array |
| POST | `/api/v1/fem/empresas` | Auth | `admin` | Alta (geocodifica la dirección); `201` + `Location` |
| PATCH | `/api/v1/fem/empresas/{id}` | Auth | `admin` | Modificar (re-geocodifica si cambia la dirección) |
| POST | `/api/v1/fem/empresas/{id}/geocodificar` | Auth | `admin` | Reintentar ubicación |

- Geocodificación con Nominatim (OpenStreetMap): máx. 1 petición/s, User-Agent de la aplicación, solo la dirección de la empresa. `GEOCODIFICACION_ACTIVA=false` la desactiva.
- `FemAlumno` incluye `empresa_id` y `ciclo`.

## Dashboard

| Método | Endpoint | Auth | Roles | Descripción |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/dashboard/kpis` | Auth | `directiva`, `admin` | Indicadores del centro |
| GET | `/api/v1/dashboard/fem` | Auth | `directiva`, `admin` | KPI 5 (empresas activas por municipio y ciclo) y KPI 6 (horas sobre las previstas) |

## Retrasos

| Método | Endpoint | Auth | Roles | Descripción |
|--------|----------|------|-------|-------------|
| POST | `/api/v1/retrasos` | Auth | `docente`, `admin` | Registrar retraso; `201` + `Location` |
| GET | `/api/v1/retrasos/{id}` | Auth | `docente`, `admin` | Detalle |
| GET | `/api/v1/alumnos/{id}/retrasos` | Auth | `docente`, `admin` | Histórico paginado (`?curso_escolar=&page=&limit=`) |
| GET | `/api/v1/alumnos` | Auth | `docente`, `admin` | Selector de alumnado (`?grupo=&q=`), array acotado a 50 |

- `curso_escolar` lo calcula el servidor (septiembre–agosto, p. ej. `2026/2027`); `grupo` se copia del alumno.
- Auditoría: `retrasos.create` en cada alta y `retrasos.consulta_historico` en **cada** consulta del histórico (datos de menores; 503 si no se puede registrar).
- Sin estadísticas agregadas para el docente: solo el Dashboard directivo.
- `Alumno` expone únicamente `id`, `nombre`, `grupo`, `curso`.

## Emplazamientos (aula)

| Método | Endpoint | Auth | Roles / regla | Descripción |
|--------|----------|------|---------------|-------------|
| GET | `/api/v1/emplazamientos` | Auth | `docente`, `admin` | Diseños de una clase (`?grupo=&modulo=`) → array |
| POST | `/api/v1/emplazamientos` | Auth | `docente`, `admin` | Crear diseño; `201` + `Location` |
| GET | `/api/v1/emplazamientos/{id}` | Auth | `docente`, `admin` | Detalle |
| PUT | `/api/v1/emplazamientos/{id}` | Auth | autor o `admin` | Sustituir diseño |
| DELETE | `/api/v1/emplazamientos/{id}` | Auth | autor o `admin` | Borrar (`204`) |

- Rejilla de hasta 10×10; `puestos` son los pupitres (las celdas sin puesto son pasillo), cada uno con `alumno_id` y `equipo` opcionales.
- `distribucion`: `filas`, `parejas`, `grupos`, `u`, `personalizada` (orientativa para la interfaz).
- `422` si un puesto queda fuera de la rejilla, se repite posición o alumno, o algún alumno no pertenece al grupo.

## Notificaciones

| Método | Endpoint | Auth | Roles / regla | Descripción |
|--------|----------|------|---------------|-------------|
| GET | `/api/v1/notificaciones` | Auth | solo propias | Bandeja paginada (`?leida=&page=&limit=`) + `no_leidas` |
| PATCH | `/api/v1/notificaciones/{id}` | Auth | destinatario | Marcar leída / no leída |
| POST | `/api/v1/notificaciones/suscripciones` | Auth | — | Registrar Web Push (`201` o `200` si ya existía) |
| DELETE | `/api/v1/notificaciones/suscripciones/{id}` | Auth | dueño | Eliminar suscripción (`204`) |

Las notificaciones **no se crean desde la API**: las generan los servicios ante eventos de negocio.

## Auditoría

| Método | Endpoint | Auth | Roles | Descripción |
|--------|----------|------|-------|-------------|
| GET | `/api/v1/auditoria` | Auth | `admin`, `directiva` | Registro paginado (solo lectura) |

Filtros: `usuario_id`, `accion`, `recurso_tipo`, `recurso_id`, `desde`, `hasta` (ISO 8601), `page`, `limit` (default 10). Intervalo inválido (`desde` > `hasta`) → 422.

Acciones runtime: `auth.login_google`, `auth.login_failed`, `auth.logout`, `usuarios.create`, `usuarios.patch`, `usuarios.put_roles`, `retrasos.create`, `retrasos.consulta_historico`, `tickets.adjunto_create`, `tickets.adjunto_delete`.  
En `patch` / `put_roles` el `detalle` incluye `antes` y `despues`. Las mutaciones de usuarios exigen persistir la traza (503 si falla Mongo); login/logout usan best-effort con log.

## Health

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/health` | Público | Liveness (proceso vivo) |
| GET | `/health/ready` | Público | Readiness (Mongo, Redis) |

## Decisiones cerradas

- `POST /auth/google`: body `{ "id_token": "..." }`; sin whitelist de dominio.
- Refresh token: cookie HttpOnly (no body JSON).
- Errores y mutaciones: norma FastAPI / recurso (sin `{code, msg}`).
- Guardias: `asignado_id` vs `cubre_id` + regla de rondas (arriba).
- Firma: `FirmaRequest` con `proveedor` (`manuscrita` \| `autofirma`) + `firma_base64`.
- Perfil PDF: `UsuarioMePatch` admite `name`, `dni`, `telefono`.

## Fuera de este contrato (fases posteriores)

Módulos de la memoria del proyecto **sin endpoints** en este OpenAPI (se definirán al abordar su fase):

| Módulo memoria | Notas |
|----------------|-------|
| Aula de convivencia | Alta por jefatura; vínculo con guardias de destino |
| Comparador de horarios | Intersección de huecos libres entre docentes |
| Repositorio documental | Docs por departamento / proyecto |
| Reserva de espacios y recursos | Con detección de solapamientos |
| Comisiones de servicio | Reutilizará flujo de PDF/firma de ausencias |
| Onboarding / primeros pasos | Guía de bienvenida (contenido, no solo `pendiente→activo`) |
| Generación IA borrador RRSS | Entrada al ticket `tipo=rrss`; no publica en redes |
| Google Calendar | Sincronización de horarios/ausencias |

## Pendiente de decisión (módulos posteriores)

- Librerías concretas de PDF, email y Web Push (VAPID).
- Si el autor puede corregir o borrar un retraso mal registrado, y en qué plazo.
- Preferencias de canal de notificación y plazo de conservación de notificaciones/auditoría.
- Proveedor de IA real para el borrador RRSS (la arquitectura y el contrato ya están listos con el generador de plantilla).
- Fuente canónica de alumnado: **resuelto parcialmente** — la intranet tiene su propia colección `alumnos` (retrasos). FEM sigue usando `fem_alumnos`; **PENDIENTE DE DECISIÓN** si se unifican y de dónde se importa el alumnado (altas hoy solo vía seed de desarrollo).
