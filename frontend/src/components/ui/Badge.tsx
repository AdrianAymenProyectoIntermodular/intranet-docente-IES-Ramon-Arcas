import type { ReactNode } from 'react'

export type BadgeTone = 'neutro' | 'sol' | 'ok' | 'error' | 'aviso' | 'info'

export function Badge({
  tone = 'neutro',
  dot = false,
  children,
}: {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span className={`badge badge-${tone}`}>
      {dot && <span className="badge-dot" aria-hidden />}
      {children}
    </span>
  )
}
