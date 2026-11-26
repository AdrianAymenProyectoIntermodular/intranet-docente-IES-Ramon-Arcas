import { ChevronRight } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'

export type Miga = { label: string; to?: string }

/** Cabecera contextual: migas, título, descripción y acciones de la vista. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  breadcrumbs?: Miga[]
}) {
  useEffect(() => {
    document.title = `${title} · Intranet IES Ramón Arcas`
  }, [title])

  return (
    <header className="page-header">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Ruta de navegación" className="breadcrumbs">
          <ol>
            {breadcrumbs.map((b, i) => (
              <li key={b.label}>
                {b.to ? <Link to={b.to}>{b.label}</Link> : <span aria-current="page">{b.label}</span>}
                {i < breadcrumbs.length - 1 && <ChevronRight size={13} aria-hidden />}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="page-header-row">
        <div className="grow">
          <h1>{title}</h1>
          {description && <p className="muted page-description">{description}</p>}
        </div>
        {actions && <div className="row page-actions">{actions}</div>}
      </div>
    </header>
  )
}
