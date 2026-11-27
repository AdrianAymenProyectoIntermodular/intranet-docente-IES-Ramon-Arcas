# Fase 2 — reparto equitativo (Intranet)

Acuerdo operativo entre **Adrian** y **Aymen**. Requisitos de cada bloque: [memoria-proyecto.md](memoria-proyecto.md) (apartado 5). Misma carga funcional, no mismo número de líneas. Un feature = una rama corta / un PR (dueño + revisor).

## Cimientos (cerrados antes de Fase 2)

| Pieza | Estado |
|-------|--------|
| Docker Compose (Mongo + Redis + API + healthchecks) | Hecho |
| Health + Auth Google/JWT + `GET /auth/me` | Hecho (API + front) |
| CRUD Usuarios (API) | Hecho (Adrian) |
| UI Usuarios (admin) | Hecho (vertical mínima en PWA) |

## Dueños por bloque

| Bloque | Dueño | Revisor | Entregable mínimo |
|--------|-------|---------|-------------------|
| Tablón de anuncios (API + UI) | Aymen | Adrian | Feed, caducidad, fijar destacado |
| Tickets genéricos (RMI + compras + RRSS/IA) | Aymen | Adrian | Una entidad; IA solo genera borrador de texto |
| FEM (listado + horas + mapa Leaflet) | Aymen | Adrian | Prefijo `/api/v1/fem`; progreso respecto a 500 h |
| Dashboard KPIs (esqueleto + datos disponibles) | Aymen | Adrian | Solo KPIs alimentables; umbral retrasos cuando exista API |
| PWA shell (layout desktop/móvil) + onboarding | Aymen | Adrian | Visual Aymen; Adrian debe poder explicar HTML/CSS |
| Roles/permisos capa completa + auditoría mínima | Adrian | Aymen | Backend auditoría cerrado en `feature/auditoria-roles`; UI consulta → rama aparte |

| Retrasos (alta + histórico; sin stats al docente) | Adrian | Aymen | Stats solo vía Dashboard |
| Emplazamiento en aula | Adrian | Aymen | Diseños configurables + asociación a clase |
| Docker / CI básica / hardening `.env` | Adrian | Aymen | Continuación de infra |

## Flujo Git por feature

1. Dueño: `feature/<nombre>` → implementa → commits principales (mensajes en español).
2. **Una rama / un PR por bloque** (no mezclar retrasos + emplazamiento + CI en la misma rama).
3. Revisor: no toca los mismos ficheros a la vez; aporta tests, examples OpenAPI, docs o la otra capa.
4. Antes de merge: el revisor explica el diff (voz / Discord).
5. Rotad dueño/revisor entre sprints cuando un bloque lo permita.

## Estado Adrian — roles / auditoría

| Pieza | Estado | Rama |
|-------|--------|------|
| Backend auditoría (filtros fecha, eventos auth, antes/después, tests) | Hecho en `feature/auditoria-roles` | `feature/auditoria-roles` |
| UI consulta auditoría (React) | Hecho (`AuditoriaPage`) | — |

## Estado de los entregables (`main`, 2026-11-27)

| Entregable memoria 5.14 | Estado |
|-------------------------|--------|
| Tablón de anuncios | Hecho: feed por ámbito (general / departamento) y **curso**, caducidad, destacados |
| Seguimiento FEM | Hecho: listado por tutor, estado (`pendiente` / `activo` / `finalizado`), horas / 500, empresas, mapa Leaflet + Nominatim |
| Publicaciones RRSS (borrador IA) | Hecho con generador **mock** (`plantilla`) acordado; proveedor real PENDIENTE DE DECISIÓN |
| Gestión de retrasos | Hecho (alta + histórico, sin stats al docente) |
| Emplazamiento en el aula | Hecho |
| Roles y permisos (capa completa) | Hecho: visibilidad de solicitudes por usuario/competencia y auditoría de todas las mutaciones |
| Primeros pasos | Hecho: guía y vídeo sugerido con guion por módulo (falta grabar los vídeos y poner su `url` en `frontend/src/lib/onboarding.ts`) |
| Incidencias RMI / Compras | Hechas sobre la entidad ticket (email al responsable → Fase 4) |
| Dashboard (extra) | KPIs 3 (con umbral configurable), 5, 6 y 7 hechos; 1, 2, 4, 8 y 9 dependen de datos de otras fases |
| CI (infra) | GitHub Actions: pytest + lint/build del frontend |

## Cierre de la Fase 2

Todos los puntos que quedaban se cerraron en `main`:

1. ~~Visibilidad de tickets~~ por solicitante, asignado o competencia (admin/directiva ven todo).
2. ~~Auditoría incompleta~~: anuncios, tickets, emplazamientos, FEM y configuración del dashboard.
3. ~~Anuncios por curso~~: `curso` opcional y `?curso=` en el feed.
4. ~~KPI 7~~: `GET /dashboard/rrss` por departamento y % publicado.
5. ~~KPI 3~~: `GET /dashboard/retrasos` + umbral en `GET/PUT /dashboard/configuracion`.
6. ~~CI básica~~: `.github/workflows/ci.yml`.
7. ~~Menores~~: estado FEM como enum, vídeos sugeridos en la guía, equivalencia de estados de ticket (en memoria-proyecto.md).

Sigue abierto (no bloquea la entrega): grabar los vídeos de la guía y elegir el proveedor real de IA para RRSS.

## Fuera de Fase 2 (no abrir aún)

- Guardias (regla de rondas), ausencias + firma PDF, aula de convivencia
- Comisiones de servicio, notificaciones push/email completas
- RGPD profundo, Google Calendar, AutoFirma (Fase 3/4)

## Orden sugerido de arranque

1. **Aymen:** Anuncios (primer módulo visible post-cimientos).
2. **Adrian:** Roles/auditoría mínima (base para el resto) en paralelo.
3. Alternar Tickets ↔ Retrasos / Emplazamiento según carga.
4. FEM + Dashboard cuando haya datos suficientes.
5. PWA shell cuando haya 2–3 pantallas reales que navegar.
