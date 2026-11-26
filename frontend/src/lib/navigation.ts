/**
 * Mapa de módulos de la intranet: agrupación del menú, rutas, roles y disponibilidad.
 * `disponible: false` → el módulo aún no tiene API; se muestra como "En desarrollo" sin datos.
 */
import type { LucideIcon } from 'lucide-react'
import {
  Armchair,
  Bell,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Compass,
  DoorOpen,
  FolderOpen,
  House,
  Inbox,
  LayoutDashboard,
  Megaphone,
  PlaneTakeoff,
  ScrollText,
  Share2,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react'
import type { Role } from '../services/types'
import { rolesDe } from './permissions'

export type Modulo = {
  id: string
  label: string
  path: string
  icon: LucideIcon
  /** Si se indica, solo lo ven usuarios con alguno de estos roles. */
  roles?: Role[]
  disponible: boolean
  /** Para módulos en desarrollo: qué hará y en qué fase llega. */
  descripcion?: string
  fase?: string
}

export type GrupoNav = {
  id: string
  label: string
  modulos: Modulo[]
}

export const NAVEGACION: GrupoNav[] = [
  {
    id: 'inicio',
    label: 'Inicio',
    modulos: [
      { id: 'inicio', label: 'Inicio', path: '/', icon: House, disponible: true },
      { id: 'bienvenida', label: 'Primeros pasos', path: '/bienvenida', icon: Compass, disponible: true },
    ],
  },
  {
    id: 'comunicacion',
    label: 'Comunicación',
    modulos: [
      { id: 'anuncios', label: 'Tablón de anuncios', path: '/anuncios', icon: Megaphone, disponible: true },
      {
        id: 'notificaciones',
        label: 'Notificaciones',
        path: '/notificaciones',
        icon: Bell,
        disponible: false,
        descripcion:
          'Avisos push y por correo cuando se publique un anuncio destacado, se te asigne una guardia, cambie tu horario o cambie el estado de una de tus solicitudes.',
        fase: 'Fase 4 — Integraciones',
      },
      {
        id: 'rrss',
        label: 'Publicaciones RRSS',
        path: '/solicitudes?tipo=rrss',
        icon: Share2,
        disponible: true,
      },
    ],
  },
  {
    id: 'aula',
    label: 'Aula y alumnado',
    modulos: [
      {
        id: 'retrasos',
        label: 'Retrasos',
        path: '/retrasos',
        icon: Timer,
        roles: rolesDe('retrasos.registrar'),
        disponible: true,
      },
      {
        id: 'emplazamiento',
        label: 'Emplazamiento en el aula',
        path: '/emplazamiento',
        icon: Armchair,
        disponible: false,
        descripcion:
          'Diseños de aula configurables (distribución de pupitres y agrupaciones) asociados a cada grupo y módulo.',
        fase: 'Fase 2 — Núcleo funcional',
      },
      {
        id: 'convivencia',
        label: 'Aula de convivencia',
        path: '/convivencia',
        icon: DoorOpen,
        disponible: false,
        descripcion:
          'Jefatura da de alta las derivaciones con su motivo y trabajo asignado; el docente de guardia del aula de convivencia ve, solo durante su hora, al alumnado derivado.',
        fase: 'Fase 3 — Guardias y firma',
      },
    ],
  },
  {
    id: 'horarios',
    label: 'Horarios y guardias',
    modulos: [
      { id: 'horario', label: 'Mi horario', path: '/horario', icon: CalendarDays, disponible: true },
      {
        id: 'guardias',
        label: 'Guardias',
        path: '/guardias',
        icon: CalendarClock,
        disponible: false,
        descripcion:
          'Cuadrante de guardias por hueco horario con asignación por rondas: distingue a quién le corresponde la guardia y quién la cubre finalmente.',
        fase: 'Fase 3 — Guardias y firma',
      },
    ],
  },
  {
    id: 'ausencias',
    label: 'Ausencias y permisos',
    modulos: [
      {
        id: 'ausencias',
        label: 'Ausencias',
        path: '/ausencias',
        icon: PlaneTakeoff,
        disponible: false,
        descripcion:
          'Comunicar una ausencia (día completo u horas), adjuntar el justificante, generar el PDF con tus datos y firmarlo a mano en pantalla o con AutoFirma.',
        fase: 'Fase 3 — Guardias y firma',
      },
      {
        id: 'comisiones',
        label: 'Comisiones de servicio',
        path: '/comisiones',
        icon: Briefcase,
        disponible: false,
        descripcion:
          'Solicitud de permiso para formaciones o reuniones de la Consejería, con generación y firma del documento PDF.',
        fase: 'Fase 3 — Guardias y firma',
      },
    ],
  },
  {
    id: 'recursos',
    label: 'Documentación y recursos',
    modulos: [
      {
        id: 'documentos',
        label: 'Repositorio documental',
        path: '/documentos',
        icon: FolderOpen,
        disponible: false,
        descripcion:
          'Documentos organizados por departamento y proyecto; cada docente ve solo los de su departamento y proyectos.',
        fase: 'Pendiente de planificar',
      },
      {
        id: 'reservas',
        label: 'Reservas',
        path: '/reservas',
        icon: CalendarRange,
        disponible: false,
        descripcion:
          'Reserva del salón de actos, biblioteca, aulas de informática y material (portátiles, proyectores) sin solapamientos.',
        fase: 'Pendiente de planificar',
      },
    ],
  },
  {
    id: 'gestion',
    label: 'Solicitudes y FEM',
    modulos: [
      { id: 'solicitudes', label: 'Solicitudes', path: '/solicitudes', icon: Inbox, disponible: true },
      {
        id: 'fem',
        label: 'Formación en Empresas',
        path: '/fem',
        icon: Briefcase,
        roles: rolesDe('fem.ver'),
        disponible: true,
      },
    ],
  },
  {
    id: 'direccion',
    label: 'Dirección',
    modulos: [
      {
        id: 'direccion',
        label: 'Indicadores del centro',
        path: '/direccion',
        icon: LayoutDashboard,
        roles: rolesDe('dashboard.ver'),
        disponible: true,
      },
      {
        id: 'auditoria',
        label: 'Auditoría',
        path: '/auditoria',
        icon: ScrollText,
        roles: rolesDe('auditoria.ver'),
        disponible: true,
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administración',
    modulos: [
      {
        id: 'usuarios',
        label: 'Usuarios y roles',
        path: '/admin/usuarios',
        icon: Users,
        roles: rolesDe('usuarios.gestionar'),
        disponible: true,
      },
      {
        id: 'privacidad',
        label: 'Privacidad y datos',
        path: '/perfil#privacidad',
        icon: ShieldCheck,
        disponible: true,
      },
    ],
  },
]

/** Menú filtrado por roles: elimina módulos sin permiso y grupos vacíos. */
export function navegacionPara(roles: readonly string[]): GrupoNav[] {
  return NAVEGACION.map((g) => ({
    ...g,
    modulos: g.modulos.filter((m) => !m.roles || m.roles.some((r) => roles.includes(r))),
  })).filter((g) => g.modulos.length > 0)
}

export const MODULOS_EN_DESARROLLO: Modulo[] = NAVEGACION.flatMap((g) => g.modulos).filter(
  (m) => !m.disponible,
)

export function moduloPorPath(path: string): Modulo | undefined {
  return NAVEGACION.flatMap((g) => g.modulos).find((m) => m.path === path)
}
