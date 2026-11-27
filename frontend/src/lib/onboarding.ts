/**
 * Vídeos cortos sugeridos para la guía de primeros pasos (memoria 5.10).
 * Cada módulo tiene un guion breve de lo que debe enseñar el vídeo. Cuando el vídeo esté grabado,
 * basta con rellenar `url` (YouTube no listado, Drive del centro…) para que la guía lo enlace.
 */
export type VideoSugerido = {
  /** Duración orientativa del vídeo. */
  duracion: string
  /** Qué debe enseñar, en una frase. */
  guion: string
  /** Enlace al vídeo publicado; vacío mientras no exista. */
  url?: string
}

export const VIDEOS_MODULO: Record<string, VideoSugerido> = {
  anuncios: {
    duracion: '1 min',
    guion: 'Leer el tablón, distinguir destacados, filtrar por ámbito o curso y, si eres dirección, publicar un anuncio con caducidad.',
  },
  rrss: {
    duracion: '2 min',
    guion: 'Pedir una publicación: título, departamento, imágenes y descripción; revisar el borrador generado y seguir su estado.',
  },
  retrasos: {
    duracion: '1 min',
    guion: 'Registrar el retraso de un alumno (fecha, hora y módulo) y consultar su histórico del curso.',
  },
  emplazamiento: {
    duracion: '2 min',
    guion: 'Crear un diseño de aula para una clase, colocar al alumnado en la rejilla y guardar varias distribuciones.',
  },
  horario: {
    duracion: '1 min',
    guion: 'Consultar el horario semanal: clases, guardias y horas de reducción.',
  },
  solicitudes: {
    duracion: '2 min',
    guion: 'Abrir una incidencia RMI o una compra, adjuntar archivos, comentar y seguir el estado hasta que se finaliza.',
  },
  fem: {
    duracion: '2 min',
    guion: 'Ver el alumnado en prácticas, actualizar sus horas sobre las 500 previstas y localizar las empresas en el mapa.',
  },
  direccion: {
    duracion: '2 min',
    guion: 'Leer los indicadores del centro y ajustar el umbral de retrasos que marca una tasa alta.',
  },
  auditoria: {
    duracion: '1 min',
    guion: 'Buscar acciones por usuario, tipo o fechas y ver el detalle de cada cambio.',
  },
  usuarios: {
    duracion: '2 min',
    guion: 'Aprobar cuentas pendientes, dar de alta usuarios y asignar roles y competencias.',
  },
  privacidad: {
    duracion: '1 min',
    guion: 'Revisar y rectificar tus datos personales y descargar una copia de ellos.',
  },
}
