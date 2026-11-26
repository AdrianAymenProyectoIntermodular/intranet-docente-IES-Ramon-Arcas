import { Clock, Lock, LogOut, RefreshCw, ServerOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { GoogleLoginButton } from '../components/GoogleLoginButton'
import { Button } from '../components/ui/Button'
import { primerNombre } from '../lib/format'
import { useAuth } from './auth-context'

/** Marco común de las pantallas previas a la intranet (sin menú). */
function AccessLayout({ children }: { children: ReactNode }) {
  return (
    <div className="access">
      <div className="access-brand" aria-hidden>
        <img src="/sol.png" alt="" className="access-sun" />
      </div>
      <main className="access-main">
        <img src="/logoIES3.png" alt="IES Ramón Arcas, Lorca" className="access-logo" />
        <div className="access-card page-enter">{children}</div>
        <p className="subtle access-foot">Uso exclusivo del profesorado del centro.</p>
      </main>
    </div>
  )
}

export function LoginPage() {
  const { refresh, error, setError } = useAuth()
  return (
    <AccessLayout>
      <div className="stack-sm">
        <h1 className="access-title">Intranet docente</h1>
        <p className="muted">
          Anuncios, horarios, solicitudes y el seguimiento de tu alumnado en un mismo sitio.
        </p>
      </div>
      <div className="access-login">
        <GoogleLoginButton onLoggedIn={() => void refresh()} onError={setError} />
        {error && (
          <p className="text-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <p className="subtle">
        Si es tu primer acceso, tu cuenta quedará pendiente hasta que la apruebe la administración del
        centro.
      </p>
    </AccessLayout>
  )
}

export function PendingPage() {
  const { user, logout, refresh } = useAuth()
  if (!user) return null
  return (
    <AccessLayout>
      <span className="access-icon access-icon-sol" aria-hidden>
        <Clock size={22} />
      </span>
      <div className="stack-sm">
        <h1 className="access-title">Hola, {primerNombre(user.name)}</h1>
        <p className="muted">
          Tu cuenta <strong>{user.email}</strong> está pendiente de aprobación. Cuando la administración
          la active podrás entrar en la intranet.
        </p>
      </div>
      <div className="row">
        <Button variant="primary" icon={RefreshCw} onClick={() => void refresh()}>
          Comprobar de nuevo
        </Button>
        <Button variant="ghost" icon={LogOut} onClick={() => void logout()}>
          Cerrar sesión
        </Button>
      </div>
    </AccessLayout>
  )
}

export function BlockedPage() {
  const { user, logout } = useAuth()
  return (
    <AccessLayout>
      <span className="access-icon" aria-hidden>
        <Lock size={22} />
      </span>
      <div className="stack-sm">
        <h1 className="access-title">Cuenta desactivada</h1>
        <p className="muted">
          La cuenta {user?.email} no tiene acceso a la intranet en este momento. Si crees que es un error,
          contacta con la administración del centro.
        </p>
      </div>
      <Button variant="ghost" icon={LogOut} onClick={() => void logout()}>
        Cerrar sesión
      </Button>
    </AccessLayout>
  )
}

export function OfflinePage() {
  const { refresh, error } = useAuth()
  return (
    <AccessLayout>
      <span className="access-icon" aria-hidden>
        <ServerOff size={22} />
      </span>
      <div className="stack-sm">
        <h1 className="access-title">Sin conexión con el servidor</h1>
        <p className="muted">{error}</p>
      </div>
      <Button variant="primary" icon={RefreshCw} onClick={() => void refresh()}>
        Reintentar
      </Button>
    </AccessLayout>
  )
}

export function SplashScreen() {
  return (
    <div className="splash" role="status" aria-label="Cargando la intranet">
      <img src="/sol.png" alt="" className="splash-sun" />
    </div>
  )
}
