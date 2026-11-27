import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Puntos de corte compartidos con el CSS (layout.css). */
export const MQ = {
  movil: '(max-width: 767px)',
  escritorio: '(min-width: 1024px)',
} as const
