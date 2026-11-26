import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, bootstrapSession, errorMessage } from '../services/api'
import { fetchMe, logout as apiLogout } from '../services/auth'
import type { UsuarioMe } from '../services/types'
import { AuthContext, type AuthState, type AuthStatus } from './auth-context'

function statusDe(user: UsuarioMe): AuthStatus {
  if (user.estado === 'activo') return 'activo'
  if (user.estado === 'pendiente') return 'pendiente'
  return 'bloqueado'
}

/**
 * Sesión: al arrancar intenta refresh por cookie → /auth/me.
 * El access token vive solo en memoria (services/api.ts).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<UsuarioMe | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const ok = await bootstrapSession()
      if (!ok) {
        setUser(null)
        setStatus('anonimo')
        return
      }
      const me = await fetchMe()
      setUser(me)
      setStatus(statusDe(me))
    } catch (err) {
      setUser(null)
      // Sin conexión con el backend: se distingue de "no hay sesión".
      if (err instanceof ApiError && err.status === 0) {
        setStatus('error')
        setError(errorMessage(err))
      } else {
        setStatus('anonimo')
      }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      setUser(null)
      setStatus('anonimo')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo<AuthState>(
    () => ({ status, user, error, refresh, logout, setError }),
    [status, user, error, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
