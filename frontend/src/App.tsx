import { Route, Routes } from 'react-router'
import { BlockedPage, LoginPage, OfflinePage, PendingPage, SplashScreen } from './auth/AccessPages'
import { useAuth } from './auth/auth-context'
import { AppShell } from './components/layout/AppShell'
import { RequireRole } from './components/layout/RequireRole'
import { MODULOS_EN_DESARROLLO } from './lib/navigation'
import { rolesDe } from './lib/permissions'
import { AnunciosPage } from './pages/AnunciosPage'
import { AuditoriaPage } from './pages/AuditoriaPage'
import { BienvenidaPage } from './pages/BienvenidaPage'
import { DireccionPage } from './pages/DireccionPage'
import { FemPage } from './pages/FemPage'
import { HorarioPage } from './pages/HorarioPage'
import { InicioPage } from './pages/InicioPage'
import { ModuloEnDesarrolloPage } from './pages/ModuloEnDesarrolloPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PerfilPage } from './pages/PerfilPage'
import { RetrasosPage } from './pages/RetrasosPage'
import { SolicitudesPage } from './pages/solicitudes/SolicitudesPage'
import { UsuariosPage } from './pages/UsuariosPage'

/** Puerta de sesión: solo las cuentas activas entran en la intranet. */
export default function App() {
  const { status } = useAuth()

  if (status === 'loading') return <SplashScreen />
  if (status === 'error') return <OfflinePage />
  if (status === 'anonimo') return <LoginPage />
  if (status === 'pendiente') return <PendingPage />
  if (status === 'bloqueado') return <BlockedPage />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<InicioPage />} />
        <Route path="bienvenida" element={<BienvenidaPage />} />
        <Route path="anuncios" element={<AnunciosPage />} />
        <Route path="solicitudes" element={<SolicitudesPage />} />
        <Route path="horario" element={<HorarioPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route
          path="retrasos"
          element={
            <RequireRole roles={rolesDe('retrasos.registrar')}>
              <RetrasosPage />
            </RequireRole>
          }
        />
        <Route
          path="fem"
          element={
            <RequireRole roles={rolesDe('fem.ver')}>
              <FemPage />
            </RequireRole>
          }
        />
        <Route
          path="direccion"
          element={
            <RequireRole roles={rolesDe('dashboard.ver')}>
              <DireccionPage />
            </RequireRole>
          }
        />
        <Route
          path="auditoria"
          element={
            <RequireRole roles={rolesDe('auditoria.ver')}>
              <AuditoriaPage />
            </RequireRole>
          }
        />
        <Route
          path="admin/usuarios"
          element={
            <RequireRole roles={rolesDe('usuarios.gestionar')}>
              <UsuariosPage />
            </RequireRole>
          }
        />
        {MODULOS_EN_DESARROLLO.map((m) => (
          <Route key={m.id} path={m.path.slice(1)} element={<ModuloEnDesarrolloPage modulo={m} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
