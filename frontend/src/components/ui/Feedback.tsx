import type { LucideIcon } from 'lucide-react'
import { CircleAlert, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

/** Estado vacío: explica qué falta y ofrece la acción para resolverlo. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  compact = false,
}: {
  icon: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
  compact?: boolean
}) {
  return (
    <div className={['empty', compact && 'empty-compact'].filter(Boolean).join(' ')}>
      <span className="empty-icon" aria-hidden>
        <Icon size={compact ? 20 : 24} />
      </span>
      <h3>{title}</h3>
      {children && <div className="muted empty-text">{children}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  )
}

/** Error de carga con reintento. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <CircleAlert size={20} aria-hidden />
      <div className="grow">
        <p className="error-state-title">No se han podido cargar los datos</p>
        <p className="muted">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" icon={RefreshCw} onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}

/** Aviso en línea (informativo o de advertencia). */
export function Notice({
  tone = 'info',
  icon: Icon,
  children,
}: {
  tone?: 'info' | 'aviso' | 'sol'
  icon?: LucideIcon
  children: ReactNode
}) {
  return (
    <div className={`notice notice-${tone}`}>
      {Icon && <Icon size={18} aria-hidden />}
      <div>{children}</div>
    </div>
  )
}

export function Skeleton({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div className="skeleton-group" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, width: i === lines - 1 ? '62%' : undefined }} />
      ))}
    </div>
  )
}

export function ProgressBar({
  value,
  max = 100,
  label,
  tone = 'sol',
}: {
  value: number
  max?: number
  label: string
  tone?: 'sol' | 'ok'
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      className={`progress progress-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}
