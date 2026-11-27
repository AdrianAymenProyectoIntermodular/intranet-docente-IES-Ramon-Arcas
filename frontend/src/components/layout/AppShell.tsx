import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { MQ, useMediaQuery } from '../../hooks/useMediaQuery'
import { BottomNav, MobileTopBar } from './MobileNav'
import { Sidebar } from './Sidebar'

const COLLAPSE_KEY = 'intranet.sidebar.colapsado'

/**
 * Estructura principal:
 * - ≥1024px: menú lateral persistente y plegable.
 * - 768–1023px: menú lateral compacto (solo iconos) por defecto.
 * - <768px: barra superior mínima + navegación inferior estilo iOS.
 */
export function AppShell() {
  const isMobile = useMediaQuery(MQ.movil)
  const isDesktop = useMediaQuery(MQ.escritorio)
  const [prefCollapsed, setPrefCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const collapsed = isDesktop ? prefCollapsed : true
  const location = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  const toggle = () => {
    setPrefCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  // Al navegar: scroll arriba y foco al contenido (lectores de pantalla anuncian la nueva vista).
  useEffect(() => {
    window.scrollTo({ top: 0 })
    mainRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <div className={['shell', isMobile ? 'shell-mobile' : collapsed ? 'shell-collapsed' : 'shell-expanded'].join(' ')}>
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      {isMobile ? <MobileTopBar /> : <Sidebar collapsed={collapsed} onToggle={toggle} />}
      <main id="contenido" ref={mainRef} tabIndex={-1} className="shell-main">
        {/* La key reinicia la animación de entrada en cada cambio de ruta. */}
        <div key={location.pathname} className="page page-enter">
          <Outlet />
        </div>
      </main>
      {isMobile && <BottomNav />}
    </div>
  )
}
