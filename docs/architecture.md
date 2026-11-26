# Arquitectura — Intranet Docente

## Sistemas

El Proyecto Intermodular DAW del IES Ramón Arcas Meca tiene **dos sistemas independientes**:

| Sistema | Stack | Este repo |
|---------|-------|-----------|
| Web Pública | PHP nativo + MySQL/MariaDB | No |
| Intranet Docente | FastAPI + MongoDB + Redis + React PWA | **Sí** |

No comparten base de datos, sesión ni autenticación.

## Stack tecnológico

### Backend

- Python 3.x
- FastAPI (>= 0.110)
- Uvicorn (>= 0.29)
- PyJWT (>= 2.8)
- google-auth (verificación de `id_token`)
- python-multipart, python-dotenv / pydantic-settings
- Pytest, Httpx
- Driver MongoDB (Motor) y cliente Redis

### Frontend (PWA)

- React + Vite + TypeScript
- `react-router` (rutas reales sin recarga), `lucide-react` (iconografía), fuentes autoalojadas `@fontsource-variable` (Roboto Slab + Figtree)
- Animaciones solo con CSS (sin librería de animación), respetando `prefers-reduced-motion`
- Manifest + iconos instalables; service worker pendiente (Fase 4, junto a Web Push)

### Infraestructura local

- Docker Compose: MongoDB, Redis, backend
- Healthchecks en los tres servicios; el backend arranca solo cuando Mongo y Redis están healthy
- Red Docker `intranet`; volumen persistente `mongo_data`
- Frontend: fuera de Compose (`npm run dev`)

## Capas del backend

```
Router (api/) → Service (services/) → Persistencia (models / acceso a datos)
```

- **Routers**: HTTP fino — validación de entrada vía esquemas, llamada al servicio, respuesta.
- **Services**: reglas de negocio (guardias, ausencias, tickets, PDF, etc.).
- **Models**: esquemas Pydantic / documentos MongoDB.
- **Core**: configuración, seguridad JWT, dependencias FastAPI (`Depends()`).
- **Utils**: helpers (email, push, etc.) cuando existan.

La lógica de negocio **no** vive en el router.

## Autenticación

```
POST /api/v1/auth/google  { "id_token": "..." }
        ↓
access token (JWT en JSON) + refresh (cookie HttpOnly)
        ↓
GET /api/v1/auth/me
        ↓
POST /api/v1/auth/refresh  → lee cookie, emite nuevo access
        ↓
POST /api/v1/auth/logout   → invalidación del refresh (Redis) + borra cookie
```

- Endpoints protegidos: header `Authorization: Bearer <access_token>`.
- El backend valida siempre identidad y roles; no confiar en datos de autorización del frontend.
- Refresh: cookie HttpOnly `refresh_token`; valor opaco guardado en Redis.
- Access JWT en el frontend: solo en memoria (no `localStorage`); tras recargar se recupera con `/auth/refresh`.
- `GET /auth/me` y logout admiten usuario `pendiente`; el resto de negocio exige `estado == activo`.
- OAuth Google sin restricción de dominio; exige `email_verified`; usuarios nuevos quedan en `pendiente` hasta aprobación admin.
- Fuera de `ENVIRONMENT=development`, `JWT_SECRET` debe ser fuerte (≥32 caracteres, no el default inseguro).

## Frontend

```
pages/ → hooks/ + services/ → API HTTP (Bearer JWT + credentials include)
components/ui → sistema de diseño (tokens en styles/tokens.css)
components/layout → AppShell (sidebar escritorio / barra inferior móvil), RequireRole
auth/ → AuthProvider (refresh → /auth/me) y pantallas de acceso
lib/ → permisos (espejo de roles-and-permissions.md), navegación, formato
```

- Sin datos simulados: cada vista consume la API real. Los módulos sin API se muestran como "En desarrollo" sin datos.
- `lib/permissions.ts` solo decide visibilidad; la autorización real es siempre del backend.

Priorizar para el arranque de la PWA:

- `GET /api/v1/auth/me`
- `GET /api/v1/usuarios/me/horario`

## Health

Endpoints operativos (fuera del contrato de negocio):

- `GET /health` — proceso vivo
- `GET /health/ready` — dependencias (Mongo, Redis) disponibles

## Temporalización (fases)

Alineada a la memoria del proyecto (apartado 5.14) y al estado del repositorio:

| Fase | Contenido memoria | Estado en este repo |
|------|-------------------|---------------------|
| **1 — Cimientos** | Esquema / temporalización; auth básica; núcleo de roles | **Hecho.** OpenAPI + docs, Google OAuth + JWT/Redis, roles, Docker Compose, PWA mínima |
| **2 — Núcleo funcional** | Anuncios, FEM, RRSS/IA, retrasos, aula, roles completos, onboarding, RMI/compras | **Parcial.** Runtime + UI: anuncios, tickets (RMI/RRSS/compras), FEM (alumnos/horas), dashboard, retrasos (+ selector de alumnado), roles/auditoría, onboarding (guía). Pendiente: emplazamiento aula, IA RRSS, mapa FEM |
| **3 — Guardias y firma** | Guardias + ausencias/firma; convivencia; comisiones; módulo ticket restante | **Contrato definido** (guardias/ausencias/firma). Runtime: rama `Adrian-guardias-ausencias`. Convivencia / comisiones / reservas / docs: fuera de contrato aún |
| **4 — Integraciones** | OAuth completo, Calendar, notificaciones push/email, docs técnicas | **Contrato** notificaciones + auditoría. Runtime y PWA instalable / Calendar: pendiente |

### Ownership orientativo

- **Adrian** (`Adrian-guardias-ausencias`): runtime de guardias, ausencias, justificante, PDF y firma.
- Módulos ya en `main` (auth, usuarios, anuncios, tickets, FEM, dashboard): base compartida; cambios vía PR a `main`.

## Fuera de este contrato (fases posteriores)

Sin endpoints en OpenAPI todavía (detalle en [api-contract.md](api-contract.md)):

- Emplazamiento en el aula, aula de convivencia, comparador de horarios
- Repositorio documental, reservas de espacios/recursos, comisiones de servicio
- Onboarding / primeros pasos (contenido)
- Mapa FEM / empresas, generación IA de borrador RRSS, Google Calendar

## Decisiones cerradas

- Payload `POST /auth/google`: `id_token`.
- Sin whitelist de dominio Google.
- Refresh token en cookie HttpOnly (no body).
- Errores API: `{"detail": "..."}` (norma FastAPI / apuntes).
- Listados paginados: `{ items, page, limit, total }`, con excepciones documentadas (anuncios, tickets, guardias → array).
- Guardias: `asignado_id` (ronda) vs `cubre_id` (quien realiza); regla de rondas en OpenAPI / api-contract.
- Firma PDF: `proveedor` `manuscrita` \| `autofirma` + `firma_base64` (manuscrita = objetivo garantizado).
- Perfil para PDF: `UsuarioMePatch` con `name`, `dni`, `telefono`.
- Adjuntos de tickets en GridFS (MongoDB), sin infraestructura adicional; validación por bytes mágicos.
- Solicitudes asignadas por competencias del usuario (`competencias`), no por roles nuevos.

## Pendiente de decisión

- Librerías concretas: generación PDF, email, push (VAPID), AutoFirma cliente.
- Proveedor de IA para el borrador RRSS. **Decidido el diseño**: interfaz `GeneradorBorrador` en `app/services/ia/` y selección por `IA_PROVEEDOR`; mientras tanto se usa el generador `plantilla` (temporal, sin IA, por indicación del profesorado).
