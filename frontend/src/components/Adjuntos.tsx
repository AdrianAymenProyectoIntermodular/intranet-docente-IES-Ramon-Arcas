import { Download, FileText, ImagePlus, Paperclip, Trash2, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { esImagen, FORMATOS_ADJUNTO, MAX_POR_TICKET, tamanoLegible, validarArchivo } from '../lib/adjuntos'
import { descargarAdjunto } from '../services/modulos'
import type { AdjuntoMeta, TicketTipo } from '../services/types'
import { IconButton } from './ui/Button'
import { Spinner } from './ui/Spinner'

/** URL temporal para previsualizar un File local; se libera al desmontar. */
function useObjectUrl(archivo: File | Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!archivo) return
    // Se crea y se revoca dentro del mismo efecto (seguro con el doble montaje de StrictMode).
    const nueva = URL.createObjectURL(archivo)
    setUrl(nueva)
    return () => {
      URL.revokeObjectURL(nueva)
      setUrl(null)
    }
  }, [archivo])
  return url
}

/**
 * Selector de archivos antes de enviar: valida formato y tamaño en el cliente
 * (el servidor vuelve a validar) y muestra miniaturas de las imágenes.
 */
export function SelectorArchivos({
  tipo,
  archivos,
  onChange,
  etiqueta,
  ayuda,
}: {
  tipo: TicketTipo
  archivos: File[]
  onChange: (archivos: File[]) => void
  etiqueta: string
  ayuda?: string
}) {
  const id = useId()
  const [errores, setErrores] = useState<string[]>([])
  const formato = FORMATOS_ADJUNTO[tipo]

  const anadir = (lista: FileList | null) => {
    if (!lista) return
    const nuevos: File[] = []
    const errs: string[] = []
    for (const f of Array.from(lista)) {
      const error = validarArchivo(tipo, f)
      if (error) errs.push(error)
      else nuevos.push(f)
    }
    const total = [...archivos, ...nuevos]
    if (total.length > MAX_POR_TICKET) errs.push(`Como mucho ${MAX_POR_TICKET} archivos por solicitud.`)
    setErrores(errs)
    onChange(total.slice(0, MAX_POR_TICKET))
  }

  return (
    <div className="field">
      <span className="field-label" id={`${id}-label`}>
        {etiqueta}
      </span>
      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          anadir(e.dataTransfer.files)
        }}
      >
        <input
          type="file"
          multiple
          accept={formato.accept}
          className="sr-only"
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            anadir(e.target.files)
            e.target.value = ''
          }}
        />
        <ImagePlus size={20} aria-hidden />
        <span>
          <strong>Elegir archivos</strong> o arrastrarlos aquí
        </span>
      </label>
      <p id={`${id}-hint`} className="field-hint">
        {ayuda ?? `${formato.texto}, hasta 5 MB cada uno.`}
      </p>
      {errores.map((e) => (
        <p key={e} className="field-error" role="alert">
          {e}
        </p>
      ))}
      {archivos.length > 0 && (
        <ul className="archivos">
          {archivos.map((f, i) => (
            <ArchivoLocal
              key={`${f.name}-${f.size}-${i}`}
              archivo={f}
              onQuitar={() => onChange(archivos.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function ArchivoLocal({ archivo, onQuitar }: { archivo: File; onQuitar: () => void }) {
  const url = useObjectUrl(esImagen(archivo.type) ? archivo : null)
  return (
    <li className="archivo">
      {url ? <img src={url} alt="" className="archivo-thumb" /> : <FileText size={22} aria-hidden className="archivo-icon" />}
      <span className="grow archivo-texto">
        <span className="archivo-nombre">{archivo.name}</span>
        <span className="subtle">{tamanoLegible(archivo.size)}</span>
      </span>
      <IconButton icon={X} label={`Quitar ${archivo.name}`} size="sm" onClick={onQuitar} />
    </li>
  )
}

/** Adjuntos ya guardados: miniaturas cargadas con el token y descarga. */
export function GaleriaAdjuntos({
  ticketId,
  adjuntos,
  puedeBorrar,
  onBorrar,
}: {
  ticketId: string
  adjuntos: AdjuntoMeta[]
  puedeBorrar: (a: AdjuntoMeta) => boolean
  onBorrar: (a: AdjuntoMeta) => void
}) {
  if (adjuntos.length === 0) return null
  return (
    <ul className="galeria" aria-label="Archivos adjuntos">
      {adjuntos.map((a) => (
        <AdjuntoRemoto key={a.id} ticketId={ticketId} adjunto={a} puedeBorrar={puedeBorrar(a)} onBorrar={() => onBorrar(a)} />
      ))}
    </ul>
  )
}

function AdjuntoRemoto({
  ticketId,
  adjunto,
  puedeBorrar,
  onBorrar,
}: {
  ticketId: string
  adjunto: AdjuntoMeta
  puedeBorrar: boolean
  onBorrar: () => void
}) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState(false)
  const imagen = esImagen(adjunto.tipo_mime)
  const url = useObjectUrl(blob)

  useEffect(() => {
    if (!imagen) return
    let vivo = true
    descargarAdjunto(ticketId, adjunto.id)
      .then((b) => vivo && setBlob(b))
      .catch(() => vivo && setError(true))
    return () => {
      vivo = false
    }
  }, [ticketId, adjunto.id, imagen])

  const descargar = async () => {
    const b = blob ?? (await descargarAdjunto(ticketId, adjunto.id))
    const enlace = document.createElement('a')
    const href = URL.createObjectURL(b)
    enlace.href = href
    enlace.download = adjunto.nombre
    enlace.click()
    URL.revokeObjectURL(href)
  }

  return (
    <li className="galeria-item">
      <div className="galeria-preview">
        {imagen ? (
          url ? (
            <img src={url} alt={adjunto.nombre} />
          ) : error ? (
            <Paperclip size={22} aria-hidden />
          ) : (
            <Spinner size={18} />
          )
        ) : (
          <FileText size={26} aria-hidden />
        )}
      </div>
      <div className="galeria-pie">
        <span className="archivo-nombre" title={adjunto.nombre}>
          {adjunto.nombre}
        </span>
        <span className="subtle">{tamanoLegible(adjunto.tamano)}</span>
      </div>
      <div className="galeria-acciones">
        <IconButton icon={Download} label={`Descargar ${adjunto.nombre}`} size="sm" variant="secondary" onClick={() => void descargar()} />
        {puedeBorrar && <IconButton icon={Trash2} label={`Borrar ${adjunto.nombre}`} size="sm" variant="secondary" onClick={onBorrar} />}
      </div>
    </li>
  )
}
