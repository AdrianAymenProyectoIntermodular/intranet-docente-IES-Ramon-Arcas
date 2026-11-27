/** Tipos de la API (alineados con openapi/openapi.yaml). */

export type Role = 'admin' | 'directiva' | 'jefatura' | 'docente' | 'tutor' | 'responsable_ticket'
export type UsuarioEstado = 'pendiente' | 'activo' | 'inactivo'

export type UsuarioPublic = {
  id: string
  name: string
  email: string
  departamento: string
  roles: Role[]
  estado: UsuarioEstado
  origen_alta?: 'manual' | 'oauth' | null
  dni?: string | null
  telefono?: string | null
  /** Tipos de solicitud que gestiona (solo con el rol responsable_ticket). */
  competencias?: TicketTipo[]
}

export type UsuarioMe = UsuarioPublic & { permisos?: string[] }

export type Paginated<T> = {
  items: T[]
  page: number
  limit: number
  total: number
}

export type UsuarioCreatePayload = {
  name: string
  email: string
  departamento: string
  roles: Role[]
  estado: UsuarioEstado
}

export type UsuarioPatchPayload = {
  name?: string
  departamento?: string
  estado?: UsuarioEstado
  competencias?: TicketTipo[]
}

export type UsuarioMePatchPayload = {
  name?: string | null
  dni?: string | null
  telefono?: string | null
}

export type BloqueTipo = 'clase' | 'guardia' | 'reduccion'

export type BloqueHorario = {
  inicio: string
  fin: string
  tipo: BloqueTipo | string
  asignatura?: string | null
  grupo?: string | null
  aula?: string | null
}

export type Horario = {
  usuario_id: string
  dias: Record<string, BloqueHorario[]>
}

export type Anuncio = {
  id: string
  titulo: string
  cuerpo: string
  departamento: string | null
  curso?: string | null
  fijado: boolean
  expira_en: string | null
  creado_en: string | null
  autor_id?: string | null
  autor_nombre?: string | null
}

export type AnuncioCreatePayload = {
  titulo: string
  cuerpo: string
  departamento?: string | null
  curso?: string | null
  expira_en?: string | null
}

export type TicketTipo = 'rmi' | 'rrss' | 'compras' | 'otro'
export type TicketEstado = 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado'

export type Ticket = {
  id: string
  tipo: TicketTipo
  estado: TicketEstado
  titulo: string
  descripcion: string | null
  solicitante_id: string
  asignado_id: string | null
  creado_en: string | null
  /** Datos propios del tipo (ver TicketDatos*). */
  datos?: TicketDatos
  adjuntos?: AdjuntoMeta[]
  borrador?: BorradorRrss | null
  solicitante_nombre?: string | null
  asignado_nombre?: string | null
}

export type AdjuntoMeta = {
  id: string
  nombre: string
  tipo_mime: string
  tamano: number
  subido_por_id: string
  subido_en: string
}

export type BorradorRrss = {
  estado: 'pendiente' | 'listo' | 'error'
  texto?: string | null
  /** "plantilla" = generador temporal sin IA */
  proveedor?: string | null
  modelo?: string | null
  generado_en?: string | null
  error?: string | null
}

export type TicketDatosRmi = { aula: string; dispositivos: string }
export type TicketDatosCompras = { articulos: string; precio_total: number; requiere_presupuesto: boolean }
export type TicketDatosRrss = { departamento: string }
export type TicketDatos = Partial<TicketDatosRmi & TicketDatosCompras & TicketDatosRrss> & Record<string, unknown>

export type TicketCreatePayload = {
  tipo: TicketTipo
  titulo: string
  descripcion?: string | null
  datos?: TicketDatosRmi | TicketDatosCompras | TicketDatosRrss | Record<string, never>
}

export type TicketPatchPayload = {
  estado?: TicketEstado
  asignado_id?: string | null
}

export type Comentario = {
  id: string
  autor_id: string
  cuerpo: string
  creado_en: string
  ticket_id?: string | null
  autor_nombre?: string | null
}

export type FemAlumno = {
  id: string
  nombre: string
  empresa: string | null
  empresa_id?: string | null
  ciclo?: string | null
  estado: string | null
  horas_cursadas: number
  horas_totales: number
  tutor_id: string | null
  tutor_nombre?: string | null
}

export type DashboardKpis = {
  ausencias_hoy: number
  guardias_pendientes: number
  tickets_abiertos: number
  docentes_activos: number
  alumnos_fem_activos: number
}

export type ProporcionActivas = { nombre: string; total: number; activas: number; porcentaje: number }

export type PublicacionesDepartamento = {
  nombre: string
  total: number
  publicadas: number
  porcentaje: number
}

export type DashboardRrss = {
  total: number
  publicadas: number
  porcentaje: number
  por_departamento: PublicacionesDepartamento[]
}

export type ConfiguracionDashboard = {
  umbral_retrasos: number
  actualizado_en?: string | null
  actualizado_por_nombre?: string | null
}

export type DashboardRetrasos = {
  curso_escolar: string
  umbral: number
  total: number
  por_grupo: { grupo: string; retrasos: number; alumnos_con_retrasos: number; alumnos_sobre_umbral: number }[]
  por_modulo: { modulo: string; retrasos: number }[]
  alumnado_sobre_umbral: { alumno_id: string; nombre: string; grupo: string; retrasos: number }[]
}

export type DashboardFem = {
  empresas_total: number
  empresas_activas: number
  porcentaje_activas: number
  por_municipio: ProporcionActivas[]
  por_ciclo: ProporcionActivas[]
  horas: { alumnos: number; cursadas: number; previstas: number; porcentaje: number }
}

export type RegistroAuditoria = {
  id: string
  usuario_id: string
  usuario_nombre: string | null
  accion: string
  recurso_tipo: string
  recurso_id: string | null
  fecha: string
  detalle: Record<string, unknown> | null
}

export type Alumno = {
  id: string
  nombre: string
  grupo: string
  curso: string
}

export type Retraso = {
  id: string
  alumno_id: string
  fecha: string
  hora: string
  modulo: string
  grupo?: string | null
  curso_escolar: string
  registrado_por_id: string
  creado_en?: string | null
}

export type RetrasoCreatePayload = {
  alumno_id: string
  fecha: string
  hora: string
  modulo: string
}

export type DatosPersonales = {
  usuario: UsuarioPublic
  exportado_en: string
  ausencias: unknown[]
  tickets: unknown[]
  suscripciones_push: unknown[]
}

export type Distribucion = 'filas' | 'parejas' | 'grupos' | 'u' | 'personalizada'

export type Puesto = {
  fila: number
  columna: number
  alumno_id: string | null
  equipo: string | null
}

export type EmplazamientoPayload = {
  nombre: string
  grupo: string
  modulo: string
  distribucion: Distribucion
  filas: number
  columnas: number
  puestos: Puesto[]
}

export type Emplazamiento = EmplazamientoPayload & {
  id: string
  autor_id: string
  autor_nombre?: string | null
  creado_en?: string | null
  actualizado_en?: string | null
}

export type FemEmpresaPayload = {
  nombre: string
  direccion: string
  municipio: string
  ciclos: string[]
  activa: boolean
}

export type FemEmpresa = FemEmpresaPayload & {
  id: string
  lat: number | null
  lon: number | null
  geocodificada: boolean
  /** Alumnado en prácticas ahora */
  alumnos: number
}
