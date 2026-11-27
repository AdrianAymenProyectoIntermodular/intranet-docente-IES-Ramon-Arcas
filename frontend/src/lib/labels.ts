/** Etiquetas de dominio para la interfaz. */
import type { BadgeTone } from '../components/ui/Badge'
import type { TicketDatos, TicketEstado, TicketTipo } from '../services/types'

export const TIPO_TICKET: Record<TicketTipo, { label: string; corto: string; descripcion: string }> = {
  rmi: {
    label: 'Incidencia RMI',
    corto: 'RMI',
    descripcion: 'Averías de equipos, red o dispositivos de un aula',
  },
  compras: {
    label: 'Gestión de compras',
    corto: 'Compras',
    descripcion: 'Peticiones de material para secretaría',
  },
  rrss: {
    label: 'Publicación en RRSS',
    corto: 'RRSS',
    descripcion: 'Actividades para difundir en las redes del centro',
  },
  otro: { label: 'Otra solicitud', corto: 'Otra', descripcion: 'Cualquier otra petición' },
}

/** Estados de la API con nombres comprensibles (pendiente → en curso → finalizado). */
export const ESTADO_TICKET: Record<TicketEstado, { label: string; tone: BadgeTone }> = {
  abierto: { label: 'Pendiente', tone: 'aviso' },
  en_proceso: { label: 'En curso', tone: 'info' },
  resuelto: { label: 'Resuelto', tone: 'ok' },
  cerrado: { label: 'Finalizado', tone: 'neutro' },
}

export const ORDEN_ESTADOS: TicketEstado[] = ['abierto', 'en_proceso', 'resuelto', 'cerrado']

/** Máquina de estados del backend: un solo paso hacia delante. */
export const SIGUIENTE_ESTADO: Record<TicketEstado, TicketEstado | null> = {
  abierto: 'en_proceso',
  en_proceso: 'resuelto',
  resuelto: 'cerrado',
  cerrado: null,
}

export const ACCION_SIGUIENTE: Record<TicketEstado, string | null> = {
  abierto: 'Empezar a gestionar',
  en_proceso: 'Marcar como resuelta',
  resuelto: 'Cerrar solicitud',
  cerrado: null,
}

export const DIAS_SEMANA = [
  { key: 'lunes', label: 'Lunes', corto: 'Lun' },
  { key: 'martes', label: 'Martes', corto: 'Mar' },
  { key: 'miercoles', label: 'Miércoles', corto: 'Mié' },
  { key: 'jueves', label: 'Jueves', corto: 'Jue' },
  { key: 'viernes', label: 'Viernes', corto: 'Vie' },
] as const

/** Índice JS (0 domingo) → clave de horario. */
export function claveDia(date = new Date()): string | null {
  const map = [null, 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', null] as const
  return map[date.getDay()]
}

export const TIPO_BLOQUE: Record<string, { label: string }> = {
  clase: { label: 'Clase' },
  guardia: { label: 'Guardia' },
  reduccion: { label: 'Reducción horaria' },
}

export const ESTADO_FEM: Record<string, { label: string; tone: BadgeTone }> = {
  activo: { label: 'En prácticas', tone: 'info' },
  pendiente: { label: 'Sin empezar', tone: 'aviso' },
  finalizado: { label: 'Finalizada', tone: 'ok' },
}

export const ACCION_AUDITORIA: Record<string, string> = {
  'auth.login_google': 'Inicio de sesión',
  'auth.login_failed': 'Inicio de sesión fallido',
  'auth.logout': 'Cierre de sesión',
  'usuarios.create': 'Alta de usuario',
  'usuarios.patch': 'Modificación de usuario',
  'usuarios.put_roles': 'Cambio de roles',
  'retrasos.create': 'Registro de retraso',
  'retrasos.consulta_historico': 'Consulta de histórico de retrasos',
  'anuncios.create': 'Publicación de anuncio',
  'anuncios.fijar': 'Anuncio fijado o desfijado',
  'tickets.create': 'Nueva solicitud',
  'tickets.patch': 'Cambio de estado o asignación de solicitud',
  'tickets.comentario_create': 'Comentario en solicitud',
  'tickets.borrador_regenerar': 'Borrador RRSS regenerado',
  'tickets.adjunto_create': 'Adjunto añadido a solicitud',
  'tickets.adjunto_delete': 'Adjunto borrado de solicitud',
  'emplazamientos.create': 'Diseño de aula creado',
  'emplazamientos.update': 'Diseño de aula modificado',
  'emplazamientos.delete': 'Diseño de aula borrado',
  'fem.horas_patch': 'Horas FEM actualizadas',
  'fem.empresa_create': 'Alta de empresa FEM',
  'fem.empresa_patch': 'Modificación de empresa FEM',
  'fem.empresa_geocodificar': 'Empresa FEM geolocalizada',
}

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** Campos de `datos` de un ticket como pares etiqueta/valor, en el orden en que se muestran. */
export function camposDatos(tipo: TicketTipo, datos: TicketDatos | undefined): { label: string; valor: string }[] {
  const d = datos ?? {}
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const campos: { label: string; valor: string }[] = []
  if (tipo === 'rmi') {
    campos.push({ label: 'Aula o espacio', valor: texto(d.aula) })
    campos.push({ label: 'Dispositivos afectados', valor: texto(d.dispositivos) })
  } else if (tipo === 'compras') {
    campos.push({ label: 'Artículos', valor: texto(d.articulos) })
    const precio = typeof d.precio_total === 'number' ? d.precio_total : Number(d.precio_total)
    campos.push({ label: 'Precio total', valor: Number.isFinite(precio) && d.precio_total !== undefined ? euros.format(precio) : '' })
    campos.push({ label: 'Requiere presupuesto', valor: d.requiere_presupuesto ? 'Sí' : 'No' })
  } else if (tipo === 'rrss') {
    campos.push({ label: 'Departamento', valor: texto(d.departamento) })
  }
  return campos.filter((c) => c.valor)
}

/** Resumen de una línea para listados. */
export function resumenDatos(tipo: TicketTipo, datos: TicketDatos | undefined): string | null {
  const d = datos ?? {}
  if (tipo === 'rmi' && d.aula) return `Aula ${d.aula}: ${d.dispositivos ?? ''}`.trim()
  if (tipo === 'compras' && d.articulos) {
    const primera = String(d.articulos).split('\n')[0]
    return typeof d.precio_total === 'number' ? `${euros.format(d.precio_total)}, ${primera}` : primera
  }
  if (tipo === 'rrss' && d.departamento) return `Departamento de ${d.departamento}`
  return null
}
