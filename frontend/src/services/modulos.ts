/** Servicios de los módulos de negocio (anuncios, tickets, FEM, dashboard, auditoría, retrasos). */
import { apiBlob, apiFetch, apiUpload, query } from './api'
import type {
  AdjuntoMeta,
  Alumno,
  Anuncio,
  AnuncioCreatePayload,
  Comentario,
  DashboardKpis,
  FemAlumno,
  Paginated,
  RegistroAuditoria,
  Retraso,
  RetrasoCreatePayload,
  Ticket,
  TicketCreatePayload,
  TicketEstado,
  TicketPatchPayload,
  TicketTipo,
} from './types'

/* Anuncios */
export function listAnuncios(departamento?: string): Promise<Anuncio[]> {
  return apiFetch<Anuncio[]>(`/api/v1/anuncios${query({ departamento })}`)
}

export function createAnuncio(payload: AnuncioCreatePayload): Promise<Anuncio> {
  return apiFetch<Anuncio>('/api/v1/anuncios', { method: 'POST', body: JSON.stringify(payload) })
}

export function fijarAnuncio(id: string, fijado: boolean): Promise<Anuncio> {
  return apiFetch<Anuncio>(`/api/v1/anuncios/${id}/fijar`, {
    method: 'PATCH',
    body: JSON.stringify({ fijado }),
  })
}

/* Tickets */
export function listTickets(params: { tipo?: TicketTipo; estado?: TicketEstado } = {}): Promise<Ticket[]> {
  return apiFetch<Ticket[]>(`/api/v1/tickets${query(params)}`)
}

export function createTicket(payload: TicketCreatePayload): Promise<Ticket> {
  return apiFetch<Ticket>('/api/v1/tickets', { method: 'POST', body: JSON.stringify(payload) })
}

export function patchTicket(id: string, payload: TicketPatchPayload): Promise<Ticket> {
  return apiFetch<Ticket>(`/api/v1/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function listComentarios(ticketId: string): Promise<Comentario[]> {
  return apiFetch<Comentario[]>(`/api/v1/tickets/${ticketId}/comentarios`)
}

export function createComentario(ticketId: string, cuerpo: string): Promise<Comentario> {
  return apiFetch<Comentario>(`/api/v1/tickets/${ticketId}/comentarios`, {
    method: 'POST',
    body: JSON.stringify({ cuerpo }),
  })
}

/* Adjuntos de tickets */
export function subirAdjunto(ticketId: string, archivo: File): Promise<AdjuntoMeta> {
  return apiUpload<AdjuntoMeta>(`/api/v1/tickets/${ticketId}/adjuntos`, 'archivo', archivo)
}

export function descargarAdjunto(ticketId: string, adjuntoId: string): Promise<Blob> {
  return apiBlob(`/api/v1/tickets/${ticketId}/adjuntos/${adjuntoId}`)
}

export function borrarAdjunto(ticketId: string, adjuntoId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/tickets/${ticketId}/adjuntos/${adjuntoId}`, { method: 'DELETE' })
}

/* FEM */
export function listFemAlumnos(estado?: string): Promise<FemAlumno[]> {
  return apiFetch<FemAlumno[]>(`/api/v1/fem/alumnos${query({ estado })}`)
}

export function patchFemHoras(id: string, horas_cursadas: number): Promise<FemAlumno> {
  return apiFetch<FemAlumno>(`/api/v1/fem/alumnos/${id}/horas`, {
    method: 'PATCH',
    body: JSON.stringify({ horas_cursadas }),
  })
}

/* Dashboard */
export function fetchKpis(): Promise<DashboardKpis> {
  return apiFetch<DashboardKpis>('/api/v1/dashboard/kpis')
}

/* Auditoría */
export function listAuditoria(params: {
  page?: number
  limit?: number
  usuario_id?: string
  accion?: string
  recurso_tipo?: string
  desde?: string
  hasta?: string
}): Promise<Paginated<RegistroAuditoria>> {
  return apiFetch<Paginated<RegistroAuditoria>>(`/api/v1/auditoria${query(params)}`)
}

/* Alumnado y retrasos */
export function listAlumnos(params: { grupo?: string; q?: string } = {}): Promise<Alumno[]> {
  return apiFetch<Alumno[]>(`/api/v1/alumnos${query(params)}`)
}

export function createRetraso(payload: RetrasoCreatePayload): Promise<Retraso> {
  return apiFetch<Retraso>('/api/v1/retrasos', { method: 'POST', body: JSON.stringify(payload) })
}

export function listRetrasosAlumno(
  alumnoId: string,
  params: { curso_escolar?: string; page?: number; limit?: number } = {},
): Promise<Paginated<Retraso>> {
  return apiFetch<Paginated<Retraso>>(`/api/v1/alumnos/${alumnoId}/retrasos${query(params)}`)
}
