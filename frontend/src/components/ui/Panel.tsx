import type { ReactNode } from 'react'

/** Contenedor de sección con cabecera opcional (título + acciones). */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  flush = false,
  as: Tag = 'section',
  id,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  /** Sin padding interno (tablas, listas a sangre). */
  flush?: boolean
  as?: 'section' | 'div' | 'article'
  id?: string
}) {
  return (
    <Tag id={id} className={['panel', flush && 'panel-flush', className].filter(Boolean).join(' ')}>
      {(title || actions) && (
        <header className="panel-header">
          <div className="grow">
            {title && <h2 className="panel-title">{title}</h2>}
            {description && <p className="subtle">{description}</p>}
          </div>
          {actions && <div className="row panel-actions">{actions}</div>}
        </header>
      )}
      <div className="panel-body">{children}</div>
    </Tag>
  )
}
