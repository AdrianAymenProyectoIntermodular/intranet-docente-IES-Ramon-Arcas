import { Check, MessageSquare, Paperclip, Send, UserCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useUser } from '../../auth/auth-context'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { EmptyState, ErrorState, Notice, Skeleton } from '../../components/ui/Feedback'
import { Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast-context'
import { useApi } from '../../hooks/useApi'
import { useNombre } from '../../hooks/useNombre'
import { formatFechaHora } from '../../lib/format'
import {
  ACCION_SIGUIENTE,
  camposDatos,
  ESTADO_TICKET,
  ORDEN_ESTADOS,
  SIGUIENTE_ESTADO,
  TIPO_TICKET,
} from '../../lib/labels'
import { errorMessage } from '../../services/api'
import { GaleriaAdjuntos } from '../../components/Adjuntos'
import { Spinner } from '../../components/ui/Spinner'
import { FORMATOS_ADJUNTO, MAX_POR_TICKET, validarArchivo } from '../../lib/adjuntos'
import { borrarAdjunto, createComentario, listComentarios, patchTicket, subirAdjunto } from '../../services/modulos'
import type { AdjuntoMeta, Ticket, UsuarioMe } from '../../services/types'
import { listUsuarios } from '../../services/usuarios'

/** Mismas reglas que ticket_service (backend): solo para mostrar u ocultar acciones. */
function puedeGestionar(user: UsuarioMe, t: Ticket): boolean {
  if (user.roles.includes('admin')) return true
  if (user.roles.includes('responsable_ticket') && (user.competencias ?? []).includes(t.tipo)) {
    return t.asignado_id === null || t.asignado_id === user.id
  }
  return false
}

function puedeComentar(roles: string[], t: Ticket, userId: string): boolean {
  if (roles.includes('admin') || roles.includes('responsable_ticket')) return true
  return t.solicitante_id === userId || t.asignado_id === userId
}

export function TicketDetalle({
  ticket,
  onClose,
  onUpdated,
}: {
  ticket: Ticket | null
  onClose: () => void
  onUpdated: (t: Ticket) => void
}) {
  return (
    <Modal
      open={ticket !== null}
      onClose={onClose}
      variant="drawer"
      title={ticket?.titulo ?? 'Solicitud'}
      description={ticket ? TIPO_TICKET[ticket.tipo].label : undefined}
    >
      {ticket && <DetalleContenido key={ticket.id} ticket={ticket} onUpdated={onUpdated} />}
    </Modal>
  )
}

function DetalleContenido({ ticket: t, onUpdated }: { ticket: Ticket; onUpdated: (t: Ticket) => void }) {
  const user = useUser()
  const toast = useToast()
  const nombre = useNombre()
  const gestiona = puedeGestionar(user, t)
  const esAdmin = user.roles.includes('admin')
  const comenta = puedeComentar(user.roles, t, user.id)
  const siguiente = SIGUIENTE_ESTADO[t.estado]
  const [confirmar, setConfirmar] = useState(false)
  const [busy, setBusy] = useState(false)

  const avanzar = async () => {
    if (!siguiente) return
    try {
      // Un responsable que toma una solicitud libre queda asignado a ella.
      const asignarme = !t.asignado_id && !user.roles.includes('admin')
      const updated = await patchTicket(t.id, {
        estado: siguiente,
        ...(asignarme ? { asignado_id: user.id } : {}),
      })
      onUpdated(updated)
      toast.ok(`Estado cambiado a «${ESTADO_TICKET[updated.estado].label}»`)
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  const asignarme = async () => {
    setBusy(true)
    try {
      const updated = await patchTicket(t.id, { asignado_id: user.id })
      onUpdated(updated)
      toast.ok('Te has asignado la solicitud')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const pasoActual = ORDEN_ESTADOS.indexOf(t.estado)
  const datos = camposDatos(t.tipo, t.datos)

  return (
    <div className="stack detalle">
      <ol className="stepper" aria-label="Progreso de la solicitud">
        {ORDEN_ESTADOS.map((s, i) => (
          <li
            key={s}
            className={['step', i < pasoActual && 'is-done', i === pasoActual && 'is-current'].filter(Boolean).join(' ')}
            aria-current={i === pasoActual ? 'step' : undefined}
          >
            <span className="step-dot" aria-hidden>
              {i < pasoActual && <Check size={12} />}
            </span>
            <span className="step-label">{ESTADO_TICKET[s].label}</span>
          </li>
        ))}
      </ol>

      <dl className="meta-grid">
        <div>
          <dt>Solicitante</dt>
          <dd>{nombre(t.solicitante_id, t.solicitante_nombre)}</dd>
        </div>
        <div>
          <dt>Responsable</dt>
          <dd>{nombre(t.asignado_id, t.asignado_nombre)}</dd>
        </div>
        <div>
          <dt>Creada</dt>
          <dd>{formatFechaHora(t.creado_en)}</dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <Badge tone={ESTADO_TICKET[t.estado].tone} dot>
              {ESTADO_TICKET[t.estado].label}
            </Badge>
          </dd>
        </div>
      </dl>

      {datos.length > 0 && (
        <dl className="datos-lista">
          {datos.map((c) => (
            <div key={c.label}>
              <dt>{c.label}</dt>
              <dd>{c.valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {t.descripcion && <div className="detalle-descripcion">{t.descripcion}</div>}

      <SeccionAdjuntos ticket={t} onUpdated={onUpdated} />

      {t.tipo === 'rrss' && (
        <Notice tone="info">
          El equipo de RRSS revisa la solicitud, descarga las imágenes y publica a mano en las redes del
          centro: nada se publica automáticamente.
        </Notice>
      )}

      {gestiona && (siguiente || !t.asignado_id) && (
        <div className="row detalle-acciones">
          {!t.asignado_id && (
            <Button icon={UserCheck} onClick={() => void asignarme()} loading={busy}>
              Asignármela
            </Button>
          )}
          {siguiente && (
            <Button variant="primary" onClick={() => setConfirmar(true)}>
              {ACCION_SIGUIENTE[t.estado]}
            </Button>
          )}
        </div>
      )}

      {esAdmin && <Reasignar ticket={t} onUpdated={onUpdated} />}

      <Comentarios ticket={t} puedeComentar={comenta} />

      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title={ACCION_SIGUIENTE[t.estado] ?? 'Cambiar estado'}
        confirmLabel={ACCION_SIGUIENTE[t.estado] ?? 'Confirmar'}
        onConfirm={avanzar}
      >
        La solicitud pasará a <strong>{siguiente ? ESTADO_TICKET[siguiente].label : ''}</strong>. Los estados solo
        avanzan: no se puede volver atrás.
      </ConfirmDialog>
    </div>
  )
}

/** Archivos de la solicitud: galería, añadir (implicados) y borrar (quien subió o admin). */
function SeccionAdjuntos({ ticket, onUpdated }: { ticket: Ticket; onUpdated: (t: Ticket) => void }) {
  const user = useUser()
  const toast = useToast()
  const [subiendo, setSubiendo] = useState(false)
  const [aBorrar, setABorrar] = useState<AdjuntoMeta | null>(null)
  const adjuntos = ticket.adjuntos ?? []
  const esAdmin = user.roles.includes('admin')
  const puedeAdjuntar = esAdmin || user.id === ticket.solicitante_id || user.id === ticket.asignado_id
  const formato = FORMATOS_ADJUNTO[ticket.tipo]

  if (adjuntos.length === 0 && !puedeAdjuntar) return null

  const subir = async (lista: FileList | null) => {
    if (!lista) return
    setSubiendo(true)
    let actual = adjuntos
    for (const archivo of Array.from(lista)) {
      const error = validarArchivo(ticket.tipo, archivo)
      if (error) {
        toast.error(error)
        continue
      }
      try {
        actual = [...actual, await subirAdjunto(ticket.id, archivo)]
      } catch (err) {
        toast.error(`No se pudo subir ${archivo.name}: ${errorMessage(err)}`)
      }
    }
    if (actual.length !== adjuntos.length) {
      onUpdated({ ...ticket, adjuntos: actual })
      toast.ok(actual.length - adjuntos.length === 1 ? 'Archivo adjuntado' : 'Archivos adjuntados')
    }
    setSubiendo(false)
  }

  const borrar = async () => {
    if (!aBorrar) return
    try {
      await borrarAdjunto(ticket.id, aBorrar.id)
      onUpdated({ ...ticket, adjuntos: adjuntos.filter((a) => a.id !== aBorrar.id) })
      toast.ok('Archivo borrado')
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  return (
    <section className="adjuntos" aria-label="Archivos adjuntos">
      <div className="row-between">
        <h3>Archivos {adjuntos.length > 0 && <span className="subtle num">({adjuntos.length})</span>}</h3>
        {puedeAdjuntar && adjuntos.length < MAX_POR_TICKET && (
          <label className="btn btn-secondary btn-sm">
            {subiendo ? <Spinner size={15} /> : <Paperclip size={15} aria-hidden />}
            <span>Adjuntar</span>
            <input
              type="file"
              multiple
              accept={formato.accept}
              className="sr-only"
              disabled={subiendo}
              onChange={(e) => {
                void subir(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
        )}
      </div>
      {adjuntos.length === 0 ? (
        <p className="subtle">Sin archivos. Formatos admitidos: {formato.texto}, hasta 5 MB.</p>
      ) : (
        <GaleriaAdjuntos
          ticketId={ticket.id}
          adjuntos={adjuntos}
          puedeBorrar={(a) => esAdmin || a.subido_por_id === user.id}
          onBorrar={setABorrar}
        />
      )}
      <ConfirmDialog
        open={aBorrar !== null}
        onClose={() => setABorrar(null)}
        title="Borrar archivo"
        confirmLabel="Borrar"
        tone="danger"
        onConfirm={borrar}
      >
        Se borrará <strong>{aBorrar?.nombre}</strong> de la solicitud. No se puede deshacer.
      </ConfirmDialog>
    </section>
  )
}

/** Admin: pasar la solicitud a otro responsable con competencia en su tipo. */
function Reasignar({ ticket, onUpdated }: { ticket: Ticket; onUpdated: (t: Ticket) => void }) {
  const toast = useToast()
  const responsables = useApi(
    () =>
      listUsuarios({ rol: 'responsable_ticket', estado: 'activo', limit: 50 }).then((r) =>
        r.items.filter((u) => (u.competencias ?? []).includes(ticket.tipo)),
      ),
    [ticket.tipo],
  )
  const [destino, setDestino] = useState('')
  const [busy, setBusy] = useState(false)
  const opciones = (responsables.data ?? []).filter((u) => u.id !== ticket.asignado_id)

  if (ticket.estado === 'cerrado' || responsables.loading) return null
  if (opciones.length === 0) {
    return (
      <p className="subtle">
        {(responsables.data ?? []).length === 0
          ? `No hay responsables de «${TIPO_TICKET[ticket.tipo].label}». Asígnalos en Usuarios y roles.`
          : 'No hay otros responsables de este tipo para reasignar.'}
      </p>
    )
  }

  const reasignar = async () => {
    if (!destino) return
    setBusy(true)
    try {
      const updated = await patchTicket(ticket.id, { asignado_id: destino })
      onUpdated(updated)
      setDestino('')
      toast.ok('Solicitud reasignada')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="reasignar">
      <Select aria-label="Reasignar a" value={destino} onChange={(e) => setDestino(e.target.value)}>
        <option value="">Reasignar a…</option>
        {opciones.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </Select>
      <Button onClick={() => void reasignar()} disabled={!destino} loading={busy}>
        Reasignar
      </Button>
    </div>
  )
}

function Comentarios({ ticket, puedeComentar }: { ticket: Ticket; puedeComentar: boolean }) {
  const toast = useToast()
  const nombre = useNombre()
  const comentarios = useApi(
    () => (puedeComentar ? listComentarios(ticket.id) : Promise.resolve([])),
    [ticket.id, puedeComentar],
  )
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!puedeComentar) {
    return (
      <p className="subtle">Los comentarios solo los ven quien pidió la solicitud, su responsable y administración.</p>
    )
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const cuerpo = texto.trim()
    if (!cuerpo) return
    setEnviando(true)
    try {
      const c = await createComentario(ticket.id, cuerpo)
      comentarios.setData((prev) => [...(prev ?? []), c])
      setTexto('')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="comentarios" aria-label="Actividad y comentarios">
      <h3>Actividad</h3>
      {comentarios.loading ? (
        <Skeleton lines={2} />
      ) : comentarios.error ? (
        <ErrorState message={comentarios.error} onRetry={() => void comentarios.reload()} />
      ) : (comentarios.data ?? []).length === 0 ? (
        <EmptyState icon={MessageSquare} title="Sin comentarios" compact>
          Usa los comentarios para pedir detalles o confirmar que algo ya funciona.
        </EmptyState>
      ) : (
        <ol className="timeline">
          {(comentarios.data ?? []).map((c) => (
            <li key={c.id} className="timeline-item">
              <Avatar name={c.autor_nombre ?? '?'} size={28} />
              <div className="grow">
                <p className="timeline-head">
                  <strong>{nombre(c.autor_id, c.autor_nombre)}</strong>{' '}
                  <span className="subtle">{formatFechaHora(c.creado_en)}</span>
                </p>
                <p className="timeline-body">{c.cuerpo}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form className="comentario-form" onSubmit={(e) => void enviar(e)}>
        <label htmlFor={`comentario-${ticket.id}`} className="sr-only">
          Escribe un comentario
        </label>
        <Textarea
          id={`comentario-${ticket.id}`}
          rows={2}
          placeholder="Escribe un comentario"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Button type="submit" icon={Send} loading={enviando} disabled={!texto.trim()}>
          Comentar
        </Button>
      </form>
    </section>
  )
}
