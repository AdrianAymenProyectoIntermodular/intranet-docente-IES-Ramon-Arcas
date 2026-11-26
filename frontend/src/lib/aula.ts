/** Plantillas de distribución del aula (mismas reglas que el seed del backend). */
import type { Distribucion, Puesto } from '../services/types'

export const MAX_LADO = 10

export const DISTRIBUCIONES: { value: Distribucion; label: string; descripcion: string }[] = [
  { value: 'filas', label: 'Filas', descripcion: 'Todos los pupitres mirando a la pizarra' },
  { value: 'parejas', label: 'Parejas', descripcion: 'Pupitres de dos en dos con pasillos' },
  { value: 'grupos', label: 'Grupos de 4', descripcion: 'Islas de cuatro para trabajo cooperativo' },
  { value: 'u', label: 'En U', descripcion: 'Abierta hacia la pizarra, para debates' },
  { value: 'personalizada', label: 'Personalizada', descripcion: 'Toca una celda para poner o quitar un pupitre' },
]

export const clave = (fila: number, columna: number) => `${fila}-${columna}`

/** Genera los puestos vacíos de una plantilla. */
export function plantilla(distribucion: Distribucion, filas: number, columnas: number): Puesto[] {
  const puestos: Puesto[] = []
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      let equipo: string | null = null
      if (distribucion === 'parejas' && c % 3 === 2) continue
      if (distribucion === 'grupos') {
        if (f % 3 === 2 || c % 3 === 2) continue
        equipo = `Equipo ${Math.floor(f / 3) * Math.floor((columnas + 1) / 3) + Math.floor(c / 3) + 1}`
      }
      if (distribucion === 'u' && !(c === 0 || c === columnas - 1 || f === filas - 1)) continue
      puestos.push({ fila: f, columna: c, alumno_id: null, equipo })
    }
  }
  return puestos
}

/** Reparte al azar el alumnado sin sentar en los pupitres libres. */
export function repartir(puestos: Puesto[], alumnoIds: string[]): Puesto[] {
  const sentados = new Set(puestos.map((p) => p.alumno_id).filter(Boolean))
  const pendientes = alumnoIds.filter((id) => !sentados.has(id))
  for (let i = pendientes.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pendientes[i], pendientes[j]] = [pendientes[j], pendientes[i]]
  }
  return puestos.map((p) => (p.alumno_id || pendientes.length === 0 ? p : { ...p, alumno_id: pendientes.shift() ?? null }))
}

/** Tono estable por nombre de equipo (siempre acompañado de la etiqueta de texto). */
export function tonoEquipo(equipo: string | null | undefined): number | null {
  if (!equipo) return null
  let h = 0
  for (const ch of equipo) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 4
}
