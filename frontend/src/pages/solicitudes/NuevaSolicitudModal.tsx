import { ChevronLeft, HelpCircle, Monitor, Share2, ShoppingCart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useUser } from '../../auth/auth-context'
import { Button } from '../../components/ui/Button'
import { Notice } from '../../components/ui/Feedback'
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { departamentosCon } from '../../lib/centro'
import { camposDatos, TIPO_TICKET } from '../../lib/labels'
import { errorMessage } from '../../services/api'
import { createTicket } from '../../services/modulos'
import type { Ticket, TicketCreatePayload, TicketDatos, TicketTipo } from '../../services/types'

const ICONOS: Record<TicketTipo, LucideIcon> = {
  rmi: Monitor,
  compras: ShoppingCart,
  rrss: Share2,
  otro: HelpCircle,
}

type Campos = Record<string, string>

/** Construye la petición con los `datos` propios del tipo (validados también en la API). */
function construir(tipo: TicketTipo, c: Campos, presupuesto: boolean): TicketCreatePayload {
  const t = (k: string) => c[k]?.trim() ?? ''
  const base = { tipo, descripcion: t('descripcion') || null }
  switch (tipo) {
    case 'rmi':
      return { ...base, titulo: t('titulo'), datos: { aula: t('aula'), dispositivos: t('dispositivos') } }
    case 'compras':
      return {
        ...base,
        titulo: t('titulo'),
        datos: { articulos: t('articulos'), precio_total: Number(c.precio || 0), requiere_presupuesto: presupuesto },
      }
    case 'rrss':
      return { ...base, titulo: t('titulo') ? `Publicación: ${t('titulo')}` : '', datos: { departamento: t('departamento') } }
    default:
      return { ...base, titulo: t('titulo'), datos: {} }
  }
}

function validar(tipo: TicketTipo, c: Campos): Record<string, string> {
  const e: Record<string, string> = {}
  const req = (k: string, msg: string) => {
    if (!c[k]?.trim()) e[k] = msg
  }
  req('titulo', tipo === 'rrss' ? 'Indica el título de la actividad.' : 'Escribe un título breve.')
  if (tipo === 'rmi') {
    req('aula', 'Indica el aula o espacio.')
    req('dispositivos', 'Indica qué equipos fallan.')
    req('descripcion', 'Describe qué ocurre.')
  }
  if (tipo === 'compras') {
    req('articulos', 'Indica qué hay que comprar.')
    if (!c.precio) e.precio = 'Indica el precio total aproximado.'
    else if (Number(c.precio) < 0) e.precio = 'El precio no puede ser negativo.'
  }
  if (tipo === 'rrss') {
    req('departamento', 'Elige el departamento responsable.')
    req('descripcion', 'Resume la actividad en unas líneas.')
  }
  return e
}

export function NuevaSolicitudModal({
  open,
  tipoInicial,
  onClose,
  onCreated,
}: {
  open: boolean
  tipoInicial: TicketTipo | null
  onClose: () => void
  onCreated: (t: Ticket) => void
}) {
  const user = useUser()
  // El padre monta el modal en cada apertura: el estado empieza limpio.
  const [tipo, setTipo] = useState<TicketTipo | null>(tipoInicial)
  const [campos, setCampos] = useState<Campos>((): Campos =>
    tipoInicial === 'rrss' ? { departamento: user.departamento } : {},
  )
  const [presupuesto, setPresupuesto] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)

  const set = (k: string) => (e: { target: { value: string } }) => setCampos((c) => ({ ...c, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tipo) return
    const errs = validar(tipo, campos)
    setErrores(errs)
    if (Object.keys(errs).length) return
    setEnviando(true)
    setErrorApi(null)
    try {
      onCreated(await createTicket(construir(tipo, campos, presupuesto)))
    } catch (err) {
      setErrorApi(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  const resumen = tipo ? construir(tipo, campos, presupuesto) : null
  const camposResumen = resumen ? camposDatos(resumen.tipo, resumen.datos as TicketDatos) : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={tipo ? TIPO_TICKET[tipo].label : 'Nueva solicitud'}
      description={tipo ? TIPO_TICKET[tipo].descripcion : '¿Qué necesitas?'}
      footer={
        tipo && (
          <>
            <Button variant="ghost" icon={ChevronLeft} onClick={() => setTipo(null)} className="mr-auto">
              Cambiar tipo
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="form-solicitud" loading={enviando}>
              Enviar solicitud
            </Button>
          </>
        )
      }
    >
      {!tipo ? (
        <ul className="tipo-picker">
          {(Object.keys(TIPO_TICKET) as TicketTipo[]).map((t) => {
            const Icon = ICONOS[t]
            return (
              <li key={t}>
                <button
                  type="button"
                  className={`tipo-option tipo-${t}`}
                  onClick={() => {
                    setTipo(t)
                    setCampos(t === 'rrss' ? { departamento: user.departamento } : {})
                  }}
                >
                  <span className="tipo-option-icon">
                    <Icon size={22} aria-hidden />
                  </span>
                  <span>
                    <span className="tipo-option-title">{TIPO_TICKET[t].label}</span>
                    <span className="subtle">{TIPO_TICKET[t].descripcion}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <form id="form-solicitud" className="form" onSubmit={(e) => void submit(e)} noValidate>
          {tipo === 'rmi' && (
            <>
              <Field label="Título" required error={errores.titulo}>
                <Input value={campos.titulo ?? ''} onChange={set('titulo')} placeholder="Proyector del aula B2 no enciende" autoFocus />
              </Field>
              <div className="form-row">
                <Field label="Aula o espacio" required error={errores.aula}>
                  <Input value={campos.aula ?? ''} onChange={set('aula')} placeholder="B2" />
                </Field>
                <Field label="Dispositivos afectados" required error={errores.dispositivos}>
                  <Input value={campos.dispositivos ?? ''} onChange={set('dispositivos')} placeholder="Proyector, PC del profesor" />
                </Field>
              </div>
              <Field label="Qué ocurre" required error={errores.descripcion}>
                <Textarea value={campos.descripcion ?? ''} onChange={set('descripcion')} rows={4} />
              </Field>
            </>
          )}

          {tipo === 'compras' && (
            <>
              <Field label="Título" required error={errores.titulo}>
                <Input value={campos.titulo ?? ''} onChange={set('titulo')} placeholder="Material de laboratorio" autoFocus />
              </Field>
              <Field label="Artículos" required hint="Uno por línea, con cantidades" error={errores.articulos}>
                <Textarea value={campos.articulos ?? ''} onChange={set('articulos')} rows={3} />
              </Field>
              <div className="form-row">
                <Field label="Precio total (€)" required error={errores.precio}>
                  <Input type="number" min={0} step="0.01" inputMode="decimal" value={campos.precio ?? ''} onChange={set('precio')} />
                </Field>
                <div className="field field-check">
                  <Checkbox
                    label="¿Requiere presupuesto?"
                    description="Marca si el proveedor debe enviar presupuesto"
                    checked={presupuesto}
                    onChange={(e) => setPresupuesto(e.target.checked)}
                  />
                </div>
              </div>
              {presupuesto && (
                <Notice tone="aviso">
                  Aún no se pueden adjuntar archivos. Indica el proveedor en las observaciones y entrega el
                  presupuesto en secretaría.
                </Notice>
              )}
              <Field label="Observaciones">
                <Textarea value={campos.descripcion ?? ''} onChange={set('descripcion')} rows={2} />
              </Field>
            </>
          )}

          {tipo === 'rrss' && (
            <>
              <Notice tone="info">
                Esta solicitud no publica nada en redes. Llega al equipo de RRSS, que redacta y publica a mano.
                La generación del borrador con IA y la subida de imágenes llegarán cuando la API los admita.
              </Notice>
              <Field label="Título de la actividad" required error={errores.titulo}>
                <Input value={campos.titulo ?? ''} onChange={set('titulo')} placeholder="Semana de la Ciencia" autoFocus />
              </Field>
              <Field label="Departamento responsable" required error={errores.departamento}>
                <Select value={campos.departamento ?? ''} onChange={set('departamento')}>
                  <option value="">Elige un departamento</option>
                  {departamentosCon(user.departamento).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Descripción breve" required hint="Qué se hizo, con quién y cuándo" error={errores.descripcion}>
                <Textarea value={campos.descripcion ?? ''} onChange={set('descripcion')} rows={4} />
              </Field>
            </>
          )}

          {tipo === 'otro' && (
            <>
              <Field label="Título" required error={errores.titulo}>
                <Input value={campos.titulo ?? ''} onChange={set('titulo')} autoFocus />
              </Field>
              <Field label="Descripción">
                <Textarea value={campos.descripcion ?? ''} onChange={set('descripcion')} rows={4} />
              </Field>
            </>
          )}

          {resumen && (resumen.titulo || resumen.descripcion || camposResumen.length > 0) && (
            <div className="preview" aria-live="polite">
              <p className="preview-label">Así llegará al responsable</p>
              <p className="preview-title">{resumen.titulo || 'Sin título'}</p>
              {camposResumen.length > 0 && (
                <dl className="datos-lista datos-lista-compacta">
                  {camposResumen.map((c) => (
                    <div key={c.label}>
                      <dt>{c.label}</dt>
                      <dd>{c.valor}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {resumen.descripcion && <p className="preview-body">{resumen.descripcion}</p>}
            </div>
          )}

          {errorApi && (
            <p className="text-error" role="alert">
              {errorApi}
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
