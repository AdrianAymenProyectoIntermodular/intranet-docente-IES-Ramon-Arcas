import { createContext, useContext } from 'react'
import type { UsuarioMe } from '../services/types'

export type AuthStatus = 'loading' | 'anonimo' | 'pendiente' | 'activo' | 'bloqueado' | 'error'

export type AuthState = {
  status: AuthStatus
  user: UsuarioMe | null
  error: string | null
  /** Recarga /auth/me (tras login o cambios de perfil). */
  refresh: () => Promise<void>
  logout: () => Promise<void>
  setError: (message: string | null) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

/** Usuario activo garantizado (solo dentro de rutas protegidas). */
export function useUser(): UsuarioMe {
  const { user } = useAuth()
  if (!user) throw new Error('useUser requiere una sesión activa')
  return user
}
