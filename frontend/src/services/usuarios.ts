import { apiFetch, query } from './api'
import type {
  DatosPersonales,
  Horario,
  Paginated,
  Role,
  UsuarioCreatePayload,
  UsuarioEstado,
  UsuarioMePatchPayload,
  UsuarioPatchPayload,
  UsuarioPublic,
} from './types'

export function fetchMiHorario(): Promise<Horario> {
  return apiFetch<Horario>('/api/v1/usuarios/me/horario')
}

export function fetchMiPerfil(): Promise<UsuarioPublic> {
  return apiFetch<UsuarioPublic>('/api/v1/usuarios/me')
}

export function patchMiPerfil(payload: UsuarioMePatchPayload): Promise<UsuarioPublic> {
  return apiFetch<UsuarioPublic>('/api/v1/usuarios/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function exportarMisDatos(): Promise<DatosPersonales> {
  return apiFetch<DatosPersonales>('/api/v1/usuarios/me/datos')
}

export function listUsuarios(params: {
  page?: number
  limit?: number
  departamento?: string
  estado?: UsuarioEstado | ''
  rol?: Role | ''
} = {}): Promise<Paginated<UsuarioPublic>> {
  return apiFetch<Paginated<UsuarioPublic>>(`/api/v1/usuarios${query(params)}`)
}

export function createUsuario(payload: UsuarioCreatePayload): Promise<UsuarioPublic> {
  return apiFetch<UsuarioPublic>('/api/v1/usuarios', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function patchUsuario(id: string, payload: UsuarioPatchPayload): Promise<UsuarioPublic> {
  return apiFetch<UsuarioPublic>(`/api/v1/usuarios/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function putRoles(id: string, roles: Role[]): Promise<UsuarioPublic> {
  return apiFetch<UsuarioPublic>(`/api/v1/usuarios/${id}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roles }),
  })
}

/** Carga todo el claustro paginando (solo admin). Usado para mostrar nombres en lugar de IDs. */
export async function listTodosLosUsuarios(): Promise<UsuarioPublic[]> {
  const all: UsuarioPublic[] = []
  let page = 1
  for (;;) {
    const res = await listUsuarios({ page, limit: 50 })
    all.push(...res.items)
    if (all.length >= res.total || res.items.length === 0) break
    page += 1
  }
  return all
}
