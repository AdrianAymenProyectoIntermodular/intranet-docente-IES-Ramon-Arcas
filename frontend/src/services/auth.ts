import { apiFetch, setAccessToken } from './api'
import type { UsuarioMe } from './types'

export async function loginWithGoogleIdToken(idToken: string): Promise<void> {
  const data = await apiFetch<{ access_token: string }>('/api/v1/auth/google', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
    skipAuth: true,
  })
  setAccessToken(data.access_token)
}

export function fetchMe(): Promise<UsuarioMe> {
  return apiFetch<UsuarioMe>('/api/v1/auth/me')
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' })
  } finally {
    setAccessToken(null)
  }
}
