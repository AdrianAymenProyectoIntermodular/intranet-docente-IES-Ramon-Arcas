/**
 * Capacidades de la interfaz → roles (docs/roles-and-permissions.md).
 * Solo decide qué se MUESTRA: el backend vuelve a comprobar siempre identidad, rol y propiedad.
 */
import type { Role } from '../services/types'

export const ROLES: Role[] = ['admin', 'directiva', 'jefatura', 'docente', 'tutor', 'responsable_ticket']

export const ROL_LABEL: Record<Role, string> = {
  admin: 'Administración',
  directiva: 'Equipo directivo',
  jefatura: 'Jefatura de estudios',
  docente: 'Docente',
  tutor: 'Tutoría FEM',
  responsable_ticket: 'Responsable de solicitudes',
}

export const ROL_DESCRIPCION: Record<Role, string> = {
  admin: 'Gestión completa: usuarios, roles y configuración',
  directiva: 'Tablón, indicadores del centro y auditoría',
  jefatura: 'Asignación y modificación de guardias',
  docente: 'Uso diario: anuncios, retrasos, solicitudes',
  tutor: 'Seguimiento del alumnado en Formación en Empresas',
  responsable_ticket: 'Gestiona las solicitudes que tiene asignadas (RMI, compras, RRSS)',
}

export type Capacidad =
  | 'usuarios.gestionar'
  | 'anuncios.publicar'
  | 'anuncios.fijar'
  | 'tickets.gestionar'
  | 'fem.ver'
  | 'dashboard.ver'
  | 'retrasos.registrar'
  | 'auditoria.ver'
  | 'guardias.asignar'

const MATRIZ: Record<Capacidad, Role[]> = {
  'usuarios.gestionar': ['admin'],
  'anuncios.publicar': ['admin', 'directiva'],
  'anuncios.fijar': ['admin'],
  'tickets.gestionar': ['admin', 'responsable_ticket'],
  'fem.ver': ['admin', 'tutor'],
  'dashboard.ver': ['admin', 'directiva'],
  'retrasos.registrar': ['admin', 'docente'],
  'auditoria.ver': ['admin', 'directiva'],
  'guardias.asignar': ['admin', 'jefatura'],
}

export function rolesDe(capacidad: Capacidad): Role[] {
  return MATRIZ[capacidad]
}

export function puede(roles: readonly string[], capacidad: Capacidad): boolean {
  return MATRIZ[capacidad].some((r) => roles.includes(r))
}

export function tieneAlguno(roles: readonly string[], requeridos?: readonly Role[]): boolean {
  if (!requeridos || requeridos.length === 0) return true
  return requeridos.some((r) => roles.includes(r))
}
