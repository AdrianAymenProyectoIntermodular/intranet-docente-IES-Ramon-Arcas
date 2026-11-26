/** Utilidades de FEM compartidas por la tabla y el mapa de empresas. */
import type { FemEmpresa } from '../services/types'

export type FiltrosEmpresas = { ciclo: string; municipio: string; texto: string }

export const FILTROS_VACIOS: FiltrosEmpresas = { ciclo: '', municipio: '', texto: '' }

export function filtrarEmpresas(empresas: FemEmpresa[], f: FiltrosEmpresas): FemEmpresa[] {
  const q = f.texto.trim().toLowerCase()
  return empresas.filter(
    (e) =>
      (!f.ciclo || e.ciclos.includes(f.ciclo)) &&
      (!f.municipio || e.municipio === f.municipio) &&
      (!q || `${e.nombre} ${e.direccion}`.toLowerCase().includes(q)),
  )
}
