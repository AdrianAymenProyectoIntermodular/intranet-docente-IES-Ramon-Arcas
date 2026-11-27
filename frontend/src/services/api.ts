/**
 * Cliente HTTP hacia la API.
 * - Access JWT en memoria del módulo (no localStorage; reduce riesgo XSS).
 * - Refresh en cookie HttpOnly (credentials: 'include').
 * - Un único refresh en vuelo aunque varias peticiones reciban 401 a la vez.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

/** Access token solo en RAM; se pierde al recargar y se recupera con refresh. */
let accessToken: string | null = null
let refreshInFlight: Promise<boolean> | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

/** Error de API con el código HTTP para poder reaccionar (409, 403…). */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ApiOptions = RequestInit & { skipAuth?: boolean }

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (!res.ok) {
      setAccessToken(null)
      return false
    }
    const data = (await res.json()) as { access_token: string }
    setAccessToken(data.access_token)
    return true
  } catch {
    setAccessToken(null)
    return false
  }
}

/** Renueva el access usando la cookie HttpOnly de refresh (single-flight). */
function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/**
 * Arranque de sesión tras F5: intenta recuperar access vía cookie refresh.
 * Devuelve true si hay access listo en memoria.
 */
export async function bootstrapSession(): Promise<boolean> {
  if (getAccessToken()) return true
  return tryRefresh()
}

/** Traduce el `detail` de FastAPI (texto o lista de validación 422) a un mensaje legible. */
function detailToMessage(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
      .filter(Boolean)
    if (msgs.length) return `Datos no válidos: ${msgs.join('; ')}`
  }
  return fallback
}

const MENSAJES_ESTADO: Record<number, string> = {
  401: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  413: 'El archivo es demasiado grande.',
  415: 'Tipo de archivo no permitido.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No se ha encontrado el recurso.',
  503: 'El servidor no está disponible en este momento.',
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await apiRaw(path, options)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Subida multipart de un archivo (el navegador pone el Content-Type con su boundary). */
export async function apiUpload<T>(path: string, campo: string, archivo: File): Promise<T> {
  const body = new FormData()
  body.append(campo, archivo)
  const res = await apiRaw(path, { method: 'POST', body })
  return (await res.json()) as T
}

/** Descarga binaria autenticada (p. ej. imágenes: un <img src> no puede enviar el Bearer). */
export async function apiBlob(path: string): Promise<Blob> {
  const res = await apiRaw(path)
  return res.blob()
}

/** Petición con Bearer, refresh automático ante 401 y errores de la API como ApiError. */
async function apiRaw(path: string, options: ApiOptions = {}): Promise<Response> {
  const { skipAuth, ...init } = options
  const headers = new Headers(init.headers)
  if (!skipAuth) {
    const token = getAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const send = () => fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' })

  let res: Response
  try {
    res = await send()
  } catch {
    throw new ApiError(0, 'No se puede conectar con el servidor. Comprueba que el backend está en marcha.')
  }

  // Si el access caducó, intenta renovar una vez con la cookie refresh.
  if (res.status === 401 && !skipAuth) {
    const ok = await tryRefresh()
    if (ok) {
      const token = getAccessToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      res = await send()
    }
  }

  if (!res.ok) {
    let message = MENSAJES_ESTADO[res.status] ?? `Error ${res.status}`
    try {
      const err = (await res.json()) as { detail?: unknown }
      if (err.detail) message = detailToMessage(err.detail, message)
    } catch {
      /* cuerpo no JSON */
    }
    throw new ApiError(res.status, message)
  }
  return res
}

/** Construye `?a=1&b=2` ignorando valores vacíos. */
export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export function errorMessage(err: unknown, fallback = 'Ha ocurrido un error inesperado'): string {
  return err instanceof Error && err.message ? err.message : fallback
}
