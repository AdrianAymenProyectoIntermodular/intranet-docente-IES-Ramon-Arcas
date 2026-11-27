/** Formato de fechas y textos en es-ES. */

/**
 * La API devuelve fechas UTC a veces sin zona (Mongo naive). Las normaliza a Date.
 * Las fechas puras `YYYY-MM-DD` se interpretan en hora local (sin desplazamiento).
 */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value)
  const date = new Date(hasZone ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

const fmtFecha = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtFechaHora = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtLargo = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
const relativa = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

export function formatFecha(value: string | null | undefined): string {
  const d = parseApiDate(value)
  return d ? fmtFecha.format(d) : '—'
}

export function formatFechaHora(value: string | null | undefined): string {
  const d = parseApiDate(value)
  return d ? fmtFechaHora.format(d) : '—'
}

export function formatFechaLarga(date: Date): string {
  const s = fmtLargo.format(date)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** "hace 3 días", "ayer", "dentro de 2 semanas". */
export function formatRelativa(value: string | null | undefined, now = new Date()): string {
  const d = parseApiDate(value)
  if (!d) return '—'
  const diffMs = d.getTime() - now.getTime()
  const abs = Math.abs(diffMs)
  const min = 60_000
  const hora = 60 * min
  const dia = 24 * hora
  if (abs < hora) return relativa.format(Math.round(diffMs / min), 'minute')
  if (abs < dia) return relativa.format(Math.round(diffMs / hora), 'hour')
  if (abs < 14 * dia) return relativa.format(Math.round(diffMs / dia), 'day')
  if (abs < 60 * dia) return relativa.format(Math.round(diffMs / (7 * dia)), 'week')
  return formatFecha(value)
}

/** Fecha local en formato YYYY-MM-DD (para inputs date). */
export function isoLocal(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Hora local HH:MM. */
export function horaLocal(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** "08:15" → minutos desde medianoche. */
export function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** Curso escolar (septiembre–agosto) de una fecha: 2026/2027. */
export function cursoEscolar(date = new Date()): string {
  const inicio = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1
  return `${inicio}/${inicio + 1}`
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const a = partes[0][0] ?? ''
  const b = partes.length > 1 ? partes[1][0] : ''
  return (a + b).toUpperCase()
}

export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`
}
