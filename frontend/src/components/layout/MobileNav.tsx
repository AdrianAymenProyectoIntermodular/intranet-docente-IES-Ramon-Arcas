import { CalendarDays, Ellipsis, House, Inbox, LogOut, Megaphone } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth, useUser } from '../../auth/auth-context'
import { navegacionPara } from '../../lib/navigation'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { esActivo } from './nav-utils'

const PRINCIPALES = [
  { path: '/', label: 'Inicio', icon: House },
  { path: '/anuncios', label: 'Anuncios', icon: Megaphone },
  { path: '/solicitudes', label: 'Solicitudes', icon: Inbox },
  { path: '/horario', label: 'Horario', icon: CalendarDays },
]

/** Cabecera compacta superior en móvil: identidad del centro + acceso al perfil. */
export function MobileTopBar() {
  const user = useUser()
  return (
    <header className="mobile-top">
      <Link to="/" className="mobile-brand" aria-label="Inicio">
        <img src="/sol.png" alt="" width={28} height={28} />
        <span>Intranet</span>
      </Link>
      <Link to="/perfil" className="mobile-avatar" aria-label="Mi perfil">
        <Avatar name={user.name} size={34} />
      </Link>
    </header>
  )
}

/** Barra de navegación inferior estilo iOS con hoja "Más" para el resto de módulos. */
export function BottomNav() {
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const activoPrincipal = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
  const algunoPrincipal = PRINCIPALES.some((p) => activoPrincipal(p.path))

  return (
    <>
      <nav className="bottom-nav" aria-label="Navegación principal">
        {PRINCIPALES.map(({ path, label, icon: Icon }) => {
          const active = activoPrincipal(path)
          return (
            <Link
              key={path}
              to={path}
              className={['bottom-item', active && 'is-active'].filter(Boolean).join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={22} aria-hidden />
              <span>{label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          className={['bottom-item', !algunoPrincipal && 'is-active'].filter(Boolean).join(' ')}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
        >
          <Ellipsis size={22} aria-hidden />
          <span>Más</span>
        </button>
      </nav>
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useUser()
  const { logout } = useAuth()
  const location = useLocation()
  const grupos = navegacionPara(user.roles).filter((g) => g.id !== 'inicio')

  return (
    <Modal open={open} onClose={onClose} title="Todos los módulos">
      <div className="more-groups">
        {grupos.map((g) => (
          <section key={g.id} className="more-group">
            <h3 className="more-group-title">{g.label}</h3>
            <ul className="more-grid">
              {g.modulos.map((m) => {
                const Icon = m.icon
                const active = esActivo(m, location)
                return (
                  <li key={m.id}>
                    <Link
                      to={m.path}
                      onClick={onClose}
                      className={['more-item', active && 'is-active', !m.disponible && 'is-dev']
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="more-icon">
                        <Icon size={20} aria-hidden />
                      </span>
                      <span className="more-label">{m.label}</span>
                      {!m.disponible && <span className="nav-soon">Pronto</span>}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        <Button variant="ghost" icon={LogOut} block onClick={() => void logout()}>
          Cerrar sesión
        </Button>
      </div>
    </Modal>
  )
}
