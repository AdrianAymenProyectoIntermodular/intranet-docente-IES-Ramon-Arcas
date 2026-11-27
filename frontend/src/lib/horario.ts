import type { BloqueHorario, Horario } from '../services/types'
import { minutos } from './format'
import { DIAS_SEMANA } from './labels'

export function bloquesDelDia(horario: Horario | null, dia: string | null): BloqueHorario[] {
  if (!horario || !dia) return []
  return [...(horario.dias[dia] ?? [])].sort((a, b) => minutos(a.inicio) - minutos(b.inicio))
}

/** Rango horario común de la semana (para alinear la rejilla), con márgenes de 15 min. */
export function rangoSemana(horario: Horario | null): { inicio: number; fin: number } {
  let ini = Infinity
  let fin = -Infinity
  for (const d of DIAS_SEMANA) {
    for (const b of horario?.dias[d.key] ?? []) {
      ini = Math.min(ini, minutos(b.inicio))
      fin = Math.max(fin, minutos(b.fin))
    }
  }
  if (!Number.isFinite(ini)) return { inicio: 8 * 60, fin: 14 * 60 + 30 }
  return { inicio: Math.floor(ini / 15) * 15, fin: Math.ceil(fin / 15) * 15 }
}

/** Siguiente día lectivo con bloques a partir de mañana. */
export function siguienteDiaConClase(
  horario: Horario | null,
  desde = new Date(),
): { fecha: Date; dia: string; bloques: BloqueHorario[] } | null {
  const claves = [null, 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', null]
  for (let i = 1; i <= 7; i++) {
    const f = new Date(desde)
    f.setDate(f.getDate() + i)
    const dia = claves[f.getDay()]
    const bloques = bloquesDelDia(horario, dia)
    if (dia && bloques.length) return { fecha: f, dia, bloques }
  }
  return null
}

export function resumenSemana(horario: Horario | null) {
  let clases = 0
  let guardias = 0
  let reducciones = 0
  for (const d of DIAS_SEMANA) {
    for (const b of horario?.dias[d.key] ?? []) {
      if (b.tipo === 'clase') clases++
      else if (b.tipo === 'guardia') guardias++
      else if (b.tipo === 'reduccion') reducciones++
    }
  }
  return { clases, guardias, reducciones }
}

export function describirBloque(b: BloqueHorario): string {
  if (b.tipo === 'guardia') return 'Guardia'
  if (b.tipo === 'reduccion') return b.asignatura ? `Reducción: ${b.asignatura}` : 'Reducción horaria'
  return b.asignatura ?? 'Clase'
}
