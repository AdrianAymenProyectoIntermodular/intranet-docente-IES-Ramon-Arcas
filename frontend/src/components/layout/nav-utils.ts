import type { Location } from 'react-router'
import type { Modulo } from '../../lib/navigation'

/**
 * ¿Está activo el módulo para la URL actual?
 * Tiene en cuenta el query `tipo` para distinguir "Publicaciones RRSS" de "Solicitudes".
 */
export function esActivo(modulo: Modulo, location: Location): boolean {
  const [path, search = ''] = modulo.path.split('?')
  const cleanPath = path.split('#')[0]
  if (cleanPath === '/') return location.pathname === '/'
  if (location.pathname !== cleanPath && !location.pathname.startsWith(`${cleanPath}/`)) return false
  const tipoModulo = new URLSearchParams(search).get('tipo')
  const tipoActual = new URLSearchParams(location.search).get('tipo')
  if (tipoModulo) return tipoModulo === tipoActual
  // "Solicitudes" no se marca si estamos en la vista filtrada de RRSS.
  if (cleanPath === '/solicitudes') return tipoActual !== 'rrss'
  if (modulo.path.includes('#')) return false
  return true
}
