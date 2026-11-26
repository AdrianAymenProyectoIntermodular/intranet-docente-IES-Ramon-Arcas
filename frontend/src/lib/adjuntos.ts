/**
 * Reglas de adjuntos (espejo de app/services/adjunto_service.py).
 * El backend valida de nuevo, incluidos los bytes reales del archivo.
 */
import type { TicketTipo } from '../services/types'

export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_POR_TICKET = 10

const IMAGENES = { accept: 'image/jpeg,image/png,image/webp', exts: ['.jpg', '.jpeg', '.png', '.webp'], texto: 'JPG, PNG o WEBP' }
const IMAGENES_Y_PDF = {
  accept: 'application/pdf,image/jpeg,image/png',
  exts: ['.pdf', '.jpg', '.jpeg', '.png'],
  texto: 'PDF, JPG o PNG',
}

export const FORMATOS_ADJUNTO: Record<TicketTipo, { accept: string; exts: string[]; texto: string }> = {
  rrss: IMAGENES,
  rmi: IMAGENES,
  compras: IMAGENES_Y_PDF,
  otro: { accept: `${IMAGENES_Y_PDF.accept},image/webp`, exts: [...IMAGENES_Y_PDF.exts, '.webp'], texto: 'PDF, JPG, PNG o WEBP' },
}

export function validarArchivo(tipo: TicketTipo, archivo: File): string | null {
  const nombre = archivo.name.toLowerCase()
  const formato = FORMATOS_ADJUNTO[tipo]
  if (!formato.exts.some((e) => nombre.endsWith(e))) return `${archivo.name}: formato no admitido (${formato.texto}).`
  if (archivo.size > MAX_BYTES) return `${archivo.name}: supera los 5 MB.`
  if (archivo.size === 0) return `${archivo.name}: el archivo está vacío.`
  return null
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toLocaleString('es-ES', { maximumFractionDigits: 1 })} MB`
}

export const esImagen = (mime: string) => mime.startsWith('image/')
