import { Pencil, Search, UserCheck, UserPlus, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useUser } from '../auth/auth-context'
import { PageHeader } from '../components/layout/PageHeader'
import { Avatar } from '../components/ui/Avatar'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { DataTable, Pagination, type Column } from '../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Checkbox, Field, Input, Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../components/ui/toast-context'
import { useApi } from '../hooks/useApi'
import { invalidarDirectorio } from '../hooks/useDirectorio'
import { departamentosCon } from '../lib/centro'
import { TIPO_TICKET } from '../lib/labels'
import { ROL_DESCRIPCION, ROL_LABEL, ROLES } from '../lib/permissions'
import { errorMessage } from '../services/api'
import { createUsuario, listUsuarios, patchUsuario, putRoles } from '../services/usuarios'
import type { Role, TicketTipo, UsuarioEstado, UsuarioPublic } from '../services/types'

type FiltroEstado = 'todos' | UsuarioEstado
const ESTADOS: FiltroEstado[] = ['todos', 'pendiente', 'activo', 'inactivo']
const ESTADO_LABEL: Record<UsuarioEstado, { label: string; tone: 'aviso' | 'ok' | 'neutro' }> = {
  pendiente: { label: 'Pendiente', tone: 'aviso' },
  activo: { label: 'Activo', tone: 'ok' },
  inactivo: { label: 'Inactivo', tone: 'neutro' },
}
const LIMIT = 12

export function UsuariosPage() {
  const toast = useToast()
  const yo = useUser()
  const [params, setParams] = useSearchParams()
  const estadoParam = params.get('estado') as FiltroEstado | null
  const estado: FiltroEstado = estadoParam && ESTADOS.includes(estadoParam) ? estadoParam : 'todos'
  const [rol, setRol] = useState<Role | ''>('')
  const [departamento, setDepartamento] = useState('')
  const [texto, setTexto] = useState('')
  const [page, setPage] = useState(1)
  const [editando, setEditando] = useState<UsuarioPublic | null>(null)
  const [creando, setCreando] = useState(false)
  const [confirmar, setConfirmar] = useState<{ user: UsuarioPublic; estado: UsuarioEstado } | null>(null)

  const lista = useApi(
    () => listUsuarios({ page, limit: LIMIT, estado: estado === 'todos' ? '' : estado, rol, departamento }),
    [page, estado, rol, departamento],
  )
  const pendientes = useApi(() => listUsuarios({ estado: 'pendiente', limit: 1 }).then((r) => r.total))

  const recargar = () => {
    invalidarDirectorio()
    void lista.reload()
    void pendientes.reload()
  }

  const cambiarEstado = async (u: UsuarioPublic, nuevo: UsuarioEstado) => {
    try {
      await patchUsuario(u.id, { estado: nuevo })
      toast.ok(
        nuevo === 'activo'
          ? u.estado === 'pendiente'
            ? `Cuenta de ${u.name} aprobada`
            : `Cuenta de ${u.name} reactivada`
          : `Cuenta de ${u.name} desactivada`,
      )
      recargar()
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  const q = texto.trim().toLowerCase()
  const filas = (lista.data?.items ?? []).filter(
    (u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q),
  )

  const columns: Column<UsuarioPublic>[] = [
    {
      key: 'nombre',
      header: 'Nombre',
      sortValue: (u) => u.name,
      render: (u) => (
        <span className="cell-user">
          <Avatar name={u.name} size={32} />
          <span className="cell-main">
            <span className="cell-title">
              {u.name}
              {u.id === yo.id && <span className="subtle"> (tú)</span>}
            </span>
            <span className="subtle cell-sub">{u.email}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'departamento',
      header: 'Departamento',
      hideOnMobile: true,
      sortValue: (u) => u.departamento,
      render: (u) => u.departamento || <span className="subtle">Sin asignar</span>,
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (u) => (
        <span className="chips">
          {u.roles.map((r) => (
            <span key={r} className="chip">
              {ROL_LABEL[r] ?? r}
            </span>
          ))}
          {u.roles.includes('responsable_ticket') &&
            (u.competencias ?? []).map((c) => (
              <span key={c} className="chip chip-sol" title="Gestiona este tipo de solicitud">
                {TIPO_TICKET[c].corto}
              </span>
            ))}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortValue: (u) => u.estado,
      render: (u) => (
        <Badge tone={ESTADO_LABEL[u.estado].tone} dot>
          {ESTADO_LABEL[u.estado].label}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'end',
      render: (u) => (
        <span className="row row-end">
          {u.estado === 'pendiente' && (
            <Button size="sm" variant="primary" icon={UserCheck} onClick={() => setConfirmar({ user: u, estado: 'activo' })}>
              Aprobar
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditando(u)} aria-label={`Editar a ${u.name}`}>
            Editar
          </Button>
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Aprueba nuevas cuentas, asigna competencias y gestiona el acceso del claustro."
        breadcrumbs={[{ label: 'Administración' }, { label: 'Usuarios y roles' }]}
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setCreando(true)}>
            Dar de alta
          </Button>
        }
      />

      <Tabs<FiltroEstado>
        label="Estado de la cuenta"
        value={estado}
        onChange={(v) => {
          setPage(1)
          setParams(v === 'todos' ? {} : { estado: v }, { replace: true })
        }}
        items={ESTADOS.map((e) => ({
          value: e,
          label: e === 'todos' ? 'Todas' : `${ESTADO_LABEL[e].label}s`,
          count: e === 'pendiente' ? (pendientes.data ?? undefined) : undefined,
        }))}
      />

      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Buscar en esta página por nombre o email</span>
          <input type="search" placeholder="Nombre o email" value={texto} onChange={(e) => setTexto(e.target.value)} />
        </label>
        <Select aria-label="Filtrar por rol" className="select-inline" value={rol} onChange={(e) => {
            setPage(1)
            setRol(e.target.value as Role | '')
          }}>
          <option value="">Todos los roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROL_LABEL[r]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por departamento"
          className="select-inline"
          value={departamento}
          onChange={(e) => {
            setPage(1)
            setDepartamento(e.target.value)
          }}
        >
          <option value="">Todos los departamentos</option>
          {departamentosCon().map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </div>

      {lista.loading && !lista.data ? (
        <Skeleton lines={8} height={22} />
      ) : lista.error ? (
        <ErrorState message={lista.error} onRetry={() => void lista.reload()} />
      ) : (
        <div className={['panel', 'panel-flush', lista.loading && 'is-refreshing'].filter(Boolean).join(' ')}>
          <DataTable
            rows={filas}
            columns={columns}
            rowKey={(u) => u.id}
            caption="Usuarios"
            empty={
              <EmptyState icon={Users} title={estado === 'pendiente' ? 'No hay cuentas pendientes' : 'Nadie coincide con los filtros'} compact>
                {estado === 'pendiente' ? 'Las altas por Google aparecerán aquí hasta que las apruebes.' : undefined}
              </EmptyState>
            }
          />
          {lista.data && (
            <div className="panel-pad">
              <Pagination page={lista.data.page} limit={lista.data.limit} total={lista.data.total} onChange={setPage} />
            </div>
          )}
        </div>
      )}

      <EditarUsuarioModal
        usuario={editando}
        esYo={editando?.id === yo.id}
        onClose={() => setEditando(null)}
        onSaved={(u) => {
          toast.ok(`Cambios de ${u.name} guardados`)
          recargar()
        }}
        onCambiarEstado={(u, e) => {
          setEditando(null)
          setConfirmar({ user: u, estado: e })
        }}
      />

      <CrearUsuarioModal
        open={creando}
        onClose={() => setCreando(false)}
        onCreated={(u) => {
          toast.ok(`Cuenta de ${u.name} creada`)
          recargar()
        }}
      />

      <ConfirmDialog
        open={confirmar !== null}
        onClose={() => setConfirmar(null)}
        title={
          confirmar?.estado === 'activo'
            ? confirmar.user.estado === 'pendiente'
              ? 'Aprobar cuenta'
              : 'Reactivar cuenta'
            : 'Desactivar cuenta'
        }
        confirmLabel={confirmar?.estado === 'activo' ? (confirmar.user.estado === 'pendiente' ? 'Aprobar' : 'Reactivar') : 'Desactivar'}
        tone={confirmar?.estado === 'inactivo' ? 'danger' : 'primary'}
        onConfirm={() => (confirmar ? cambiarEstado(confirmar.user, confirmar.estado) : undefined)}
      >
        {confirmar?.estado === 'inactivo' ? (
          <>
            <strong>{confirmar.user.name}</strong> dejará de poder entrar en la intranet. Podrás reactivar la cuenta
            más adelante.
          </>
        ) : (
          <>
            <strong>{confirmar?.user.name}</strong> ({confirmar?.user.email}) podrá entrar en la intranet con los roles
            que tenga asignados.
          </>
        )}
      </ConfirmDialog>
    </>
  )
}

function RolesSelector({ value, onChange, error }: { value: Role[]; onChange: (r: Role[]) => void; error?: string }) {
  return (
    <fieldset className="fieldset">
      <legend className="field-label">Roles</legend>
      <div className="roles-grid">
        {ROLES.map((r) => (
          <Checkbox
            key={r}
            label={ROL_LABEL[r]}
            description={ROL_DESCRIPCION[r]}
            checked={value.includes(r)}
            onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))}
          />
        ))}
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  )
}

const TIPOS_COMPETENCIA: TicketTipo[] = ['rmi', 'compras', 'rrss', 'otro']

/** Tipos de solicitud que gestiona un responsable (no es un rol: es un dato del usuario). */
function CompetenciasSelector({ value, onChange }: { value: TicketTipo[]; onChange: (c: TicketTipo[]) => void }) {
  return (
    <fieldset className="fieldset">
      <legend className="field-label">Solicitudes que gestiona</legend>
      <p className="field-hint">
        Las nuevas solicitudes de cada tipo se asignan automáticamente al responsable con menos carga.
      </p>
      <div className="roles-grid">
        {TIPOS_COMPETENCIA.map((t) => (
          <Checkbox
            key={t}
            label={TIPO_TICKET[t].label}
            description={TIPO_TICKET[t].descripcion}
            checked={value.includes(t)}
            onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))}
          />
        ))}
      </div>
    </fieldset>
  )
}

const mismosElementos = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x) => b.includes(x))

function EditarUsuarioModal({
  usuario,
  esYo,
  onClose,
  onSaved,
  onCambiarEstado,
}: {
  usuario: UsuarioPublic | null
  esYo: boolean
  onClose: () => void
  onSaved: (u: UsuarioPublic) => void
  onCambiarEstado: (u: UsuarioPublic, e: UsuarioEstado) => void
}) {
  return (
    <Modal open={usuario !== null} onClose={onClose} title="Editar usuario" description={usuario?.email} size="lg">
      {usuario && (
        <EditarForm
          key={usuario.id}
          usuario={usuario}
          esYo={esYo}
          onClose={onClose}
          onSaved={onSaved}
          onCambiarEstado={onCambiarEstado}
        />
      )}
    </Modal>
  )
}

function EditarForm({
  usuario,
  esYo,
  onClose,
  onSaved,
  onCambiarEstado,
}: {
  usuario: UsuarioPublic
  esYo: boolean
  onClose: () => void
  onSaved: (u: UsuarioPublic) => void
  onCambiarEstado: (u: UsuarioPublic, e: UsuarioEstado) => void
}) {
  const [name, setName] = useState(usuario.name)
  const [departamento, setDepartamento] = useState(usuario.departamento)
  const [roles, setRoles] = useState<Role[]>(usuario.roles)
  const [competencias, setCompetencias] = useState<TicketTipo[]>(usuario.competencias ?? [])
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es obligatorio.'
    if (roles.length === 0) errs.roles = 'Asigna al menos un rol.'
    if (esYo && !roles.includes('admin')) errs.roles = 'No puedes quitarte el rol de administración a ti mismo.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    setEnviando(true)
    setErrorApi(null)
    try {
      let actualizado = usuario
      if (name.trim() !== usuario.name || departamento !== usuario.departamento) {
        actualizado = await patchUsuario(usuario.id, { name: name.trim(), departamento })
      }
      if (!mismosElementos(roles, usuario.roles)) actualizado = await putRoles(usuario.id, roles)
      if (!mismosElementos(competencias, usuario.competencias ?? [])) {
        actualizado = await patchUsuario(usuario.id, { competencias })
      }
      onSaved(actualizado)
      onClose()
    } catch (err) {
      setErrorApi(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <div className="form-row">
        <Field label="Nombre" required error={errores.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Departamento">
          <Select value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
            <option value="">Sin asignar</option>
            {departamentosCon(usuario.departamento).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <RolesSelector value={roles} onChange={setRoles} error={errores.roles} />
      {roles.includes('responsable_ticket') && <CompetenciasSelector value={competencias} onChange={setCompetencias} />}
      {errorApi && (
        <p className="text-error" role="alert">
          {errorApi}
        </p>
      )}
      <div className="form-actions">
        {!esYo &&
          (usuario.estado === 'activo' ? (
            <Button variant="danger" className="mr-auto" onClick={() => onCambiarEstado(usuario, 'inactivo')}>
              Desactivar cuenta
            </Button>
          ) : (
            <Button className="mr-auto" onClick={() => onCambiarEstado(usuario, 'activo')}>
              {usuario.estado === 'pendiente' ? 'Aprobar cuenta' : 'Reactivar cuenta'}
            </Button>
          ))}
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={enviando}>
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}

function CrearUsuarioModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (u: UsuarioPublic) => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Dar de alta a un docente"
      description="Alta manual sin Google. Cuando entre con su cuenta de Google se vinculará por email."
    >
      {open && <CrearForm onClose={onClose} onCreated={onCreated} />}
    </Modal>
  )
}

function CrearForm({ onClose, onCreated }: { onClose: () => void; onCreated: (u: UsuarioPublic) => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [roles, setRoles] = useState<Role[]>(['docente'])
  const [competencias, setCompetencias] = useState<TicketTipo[]>([])
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'El nombre es obligatorio.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Introduce un email válido.'
    if (!departamento) errs.departamento = 'Elige un departamento.'
    if (roles.length === 0) errs.roles = 'Asigna al menos un rol.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    setEnviando(true)
    setErrorApi(null)
    try {
      let u = await createUsuario({ name: name.trim(), email: email.trim(), departamento, roles, estado: 'activo' })
      if (roles.includes('responsable_ticket') && competencias.length) {
        u = await patchUsuario(u.id, { competencias })
      }
      onCreated(u)
      onClose()
    } catch (err) {
      setErrorApi(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <div className="form-row">
        <Field label="Nombre completo" required error={errores.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Email" required error={errores.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <Field label="Departamento" required error={errores.departamento}>
        <Select value={departamento} onChange={(e) => setDepartamento(e.target.value)}>
          <option value="">Elige un departamento</option>
          {departamentosCon().map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      </Field>
      <RolesSelector value={roles} onChange={setRoles} error={errores.roles} />
      {roles.includes('responsable_ticket') && <CompetenciasSelector value={competencias} onChange={setCompetencias} />}
      {errorApi && (
        <p className="text-error" role="alert">
          {errorApi}
        </p>
      )}
      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={enviando}>
          Dar de alta
        </Button>
      </div>
    </form>
  )
}
