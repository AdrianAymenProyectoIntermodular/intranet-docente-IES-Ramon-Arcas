# Frontend (React + Vite + TypeScript)

PWA de la Intranet Docente. Todos los datos que muestra vienen del backend real (`/api/v1`): no hay mocks.
Los módulos que aún no tienen API aparecen en el menú como **Pronto** y explican qué harán, sin datos de ejemplo.

## Desarrollo

```bash
cd frontend
copy .env.example .env
npm install
npm run dev
```

Variables:

- `VITE_API_BASE_URL`: base del backend (por defecto `http://localhost:8000`)
- `VITE_GOOGLE_CLIENT_ID`: el mismo Client ID OAuth que `GOOGLE_CLIENT_ID` en el backend

Tras cambiar el `.env`, reinicia Vite. Usa Chrome o Edge del sistema, porque el preview embebido suele bloquear el popup de Google.

Para tener datos de demostración, ejecuta el seed del backend (ver `backend/README.md`).

## Comprobaciones

```bash
npm run build   # tsc + build de producción
npm run lint    # oxlint
```

## Sesión

- El access JWT se guarda solo en memoria (`services/api.ts`), nunca en `localStorage`.
- El refresh viaja en una cookie HttpOnly. Al recargar se recupera con `POST /auth/refresh`, y si varias peticiones reciben 401 a la vez solo se hace un refresh.
- Arranque: refresh → `GET /auth/me` (`auth/AuthProvider.tsx`). Las cuentas `pendiente` o `inactivo` ven una pantalla propia y no entran en la intranet.

## Navegación y roles

- **Escritorio** (1024 px o más): menú lateral persistente y plegable, con grupos desplegables.
- **Tablet**: el menú lateral se muestra compacto, solo con iconos.
- **Móvil** (menos de 768 px): barra inferior estilo iOS (Inicio, Anuncios, Solicitudes, Horario, Más). Los modales se convierten en hojas inferiores.
- **Visibilidad por rol**: menú y rutas se filtran con `lib/permissions.ts`, una copia de `docs/roles-and-permissions.md`. Es solo UX: el backend sigue validando rol y propiedad en cada petición.

## Sistema de diseño

- **Tokens:** `styles/tokens.css` (colores, tipografía, espaciado, radios, sombras y movimiento). Acento `#F7A903`, el amarillo del logotipo. Sobre el acento el texto va en marino, porque el blanco no alcanza contraste AA.
- **Tipografía:** Roboto Slab para titulares (eco de la slab del logotipo) y Figtree para el texto, ambas autoalojadas con `@fontsource`.
- **Iconos:** `lucide-react`.
- **Animaciones:** solo CSS. Hay una entrada de página orquestada y respuestas a acciones (menús, modales, toasts, estados). Todo respeta `prefers-reduced-motion`.

## Estructura

```
src/
├── auth/              # AuthProvider, contexto de sesión y pantallas de acceso
├── components/
│   ├── layout/        # AppShell, Sidebar, BottomNav, PageHeader, RequireRole
│   └── ui/            # Button, Field, Modal, ConfirmDialog, DataTable, Tabs, Toast, Feedback…
├── hooks/             # useApi, useNombre, useMediaQuery
├── lib/               # permisos, navegación, etiquetas, formato de fechas, horario
├── pages/             # una vista por módulo
├── services/          # api.ts (HTTP + refresh) y servicios por dominio + tipos
└── styles/            # tokens, base, motion, layout, components, pages
```

## Limitaciones conocidas (dependen de la API)

- El borrador de RRSS con IA aún no está conectado a ningún modelo.
- El mapa de FEM necesita la ubicación de las empresas, que la API aún no guarda.
- La PWA tiene manifest e iconos, pero todavía no tiene service worker: llega en la Fase 4, junto con las notificaciones push.
