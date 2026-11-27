import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth, useUser } from '../../auth/auth-context'
import { navegacionPara, type GrupoNav } from '../../lib/navigation'
import { ROL_LABEL } from '../../lib/permissions'
import { Avatar } from '../ui/Avatar'
import { IconButton } from '../ui/Button'
import { esActivo } from './nav-utils'

const GRUPOS_KEY = 'intranet.sidebar.gruposCerrados'

function leerCerrados(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(GRUPOS_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/** Menú lateral de escritorio: grupos plegables, modo compacto y perfil abajo. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const user = useUser()
  const { logout } = useAuth()
  const location = useLocation()
  const grupos = navegacionPara(user.roles)
  const [cerrados, setCerrados] = useState<Set<string>>(leerCerrados)

  const toggleGrupo = (id: string) => {
    setCerrados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(GRUPOS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const rolPrincipal = user.roles.find((r) => r !== 'docente') ?? user.roles[0]

  return (
    <aside className={['sidebar', collapsed && 'sidebar-collapsed'].filter(Boolean).join(' ')}>
      <div className="sidebar-top">
        <Link to="/" className="sidebar-brand" aria-label="Inicio — IES Ramón Arcas">
          {collapsed ? (
            <img src="/sol.png" alt="" className="sidebar-sun" />
          ) : (
            <img src="/logoIES3.png" alt="" className="sidebar-logo" />
          )}
        </Link>
        <IconButton
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          onClick={onToggle}
          className="sidebar-toggle"
          aria-expanded={!collapsed}
        />
      </div>

      <nav className="sidebar-nav" aria-label="Módulos de la intranet">
        {grupos.map((g) => (
          <SidebarGroup
            key={g.id}
            grupo={g}
            collapsed={collapsed}
            open={collapsed || !cerrados.has(g.id)}
            onToggle={() => toggleGrupo(g.id)}
            isActive={(m) => esActivo(m, location)}
          />
        ))}
      </nav>

      <div className="sidebar-footer">
        <Link to="/perfil" className="sidebar-user" title={collapsed ? user.name : undefined}>
          <Avatar name={user.name} size={34} />
          {!collapsed && (
            <span className="sidebar-user-text">
              <span className="sidebar-user-name">{user.name}</span>
              <span className="subtle">{rolPrincipal ? ROL_LABEL[rolPrincipal] : 'Docente'}</span>
            </span>
          )}
          {collapsed && <span className="sr-only">Mi perfil</span>}
          {!collapsed && <UserRound size={16} aria-hidden className="sidebar-user-icon" />}
        </Link>
        <IconButton icon={LogOut} label="Cerrar sesión" onClick={() => void logout()} />
      </div>
    </aside>
  )
}

function SidebarGroup({
  grupo,
  collapsed,
  open,
  onToggle,
  isActive,
}: {
  grupo: GrupoNav
  collapsed: boolean
  open: boolean
  onToggle: () => void
  isActive: (m: GrupoNav['modulos'][number]) => boolean
}) {
  const listId = `nav-${grupo.id}`
  const esInicio = grupo.id === 'inicio'
  return (
    <div className="nav-group">
      {!esInicio &&
        (collapsed ? (
          <hr className="nav-sep" />
        ) : (
          <button
            type="button"
            className="nav-group-toggle"
            aria-expanded={open}
            aria-controls={listId}
            onClick={onToggle}
          >
            <span>{grupo.label}</span>
            <ChevronDown size={14} aria-hidden className="nav-chevron" />
          </button>
        ))}
      <ul id={listId} className="nav-list" data-open={open || esInicio}>
        {grupo.modulos.map((m) => {
          const active = isActive(m)
          const Icon = m.icon
          return (
            <li key={m.id}>
              <Link
                to={m.path}
                className={['nav-item', active && 'is-active', !m.disponible && 'is-dev']
                  .filter(Boolean)
                  .join(' ')}
                aria-current={active ? 'page' : undefined}
                title={collapsed ? m.label : undefined}
                tabIndex={open || esInicio ? undefined : -1}
              >
                <Icon size={18} aria-hidden className="nav-icon" />
                <span className="nav-label">{m.label}</span>
                {!m.disponible && !collapsed && <span className="nav-soon">Pronto</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
