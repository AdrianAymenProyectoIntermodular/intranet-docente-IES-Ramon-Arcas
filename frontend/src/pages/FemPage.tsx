import { Briefcase, MapPinned, Pencil, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useUser } from '../auth/auth-context'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { DataTable, type Column } from '../components/ui/DataTable'
import { EmptyState, ErrorState, ProgressBar, Skeleton } from '../components/ui/Feedback'
import { Field, Input } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { Panel } from '../components/ui/Panel'
import { Tabs } from '../components/ui/Tabs'
import { useToast } from '../components/ui/toast-context'
import { useApi } from '../hooks/useApi'
import { useDirectorio } from '../hooks/useDirectorio'
import { ESTADO_FEM } from '../lib/labels'
import { errorMessage } from '../services/api'
import { listFemAlumnos, patchFemHoras } from '../services/modulos'
import type { FemAlumno } from '../services/types'

type Filtro = 'todos' | 'activo' | 'pendiente' | 'finalizado'

const pct = (a: FemAlumno) => (a.horas_totales ? (a.horas_cursadas / a.horas_totales) * 100 : 0)

export function FemPage() {
  const user = useUser()
  const dir = useDirectorio()
  const toast = useToast()
  const esAdmin = user.roles.includes('admin')
  const { data, error, loading, reload, setData } = useApi(() => listFemAlumnos())
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState<FemAlumno | null>(null)

  const alumnos = useMemo(() => data ?? [], [data])
  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return alumnos.filter(
      (a) =>
        (filtro === 'todos' || a.estado === filtro) &&
        (!q || `${a.nombre} ${a.empresa ?? ''}`.toLowerCase().includes(q)),
    )
  }, [alumnos, filtro, texto])

  const enPracticas = alumnos.filter((a) => a.estado === 'activo')
  const mediaPct = alumnos.length ? alumnos.reduce((s, a) => s + pct(a), 0) / alumnos.length : 0
  const empresas = new Set(alumnos.map((a) => a.empresa).filter(Boolean)).size

  const columns: Column<FemAlumno>[] = [
    {
      key: 'nombre',
      header: 'Alumno',
      sortValue: (a) => a.nombre,
      render: (a) => (
        <span className="cell-main">
          <span className="cell-title">{a.nombre}</span>
          {esAdmin && <span className="subtle cell-sub">Tutor: {dir.nombre(a.tutor_id)}</span>}
        </span>
      ),
    },
    {
      key: 'empresa',
      header: 'Empresa',
      sortValue: (a) => a.empresa ?? '',
      render: (a) => (a.empresa ? a.empresa : <span className="subtle">Sin asignar</span>),
    },
    {
      key: 'estado',
      header: 'Seguimiento',
      sortValue: (a) => a.estado ?? '',
      render: (a) => {
        const e = ESTADO_FEM[a.estado ?? ''] ?? { label: a.estado ?? 'Sin estado', tone: 'neutro' as const }
        return (
          <Badge tone={e.tone} dot>
            {e.label}
          </Badge>
        )
      },
    },
    {
      key: 'progreso',
      header: 'Horas',
      sortValue: pct,
      width: '220px',
      render: (a) => (
        <div className="fem-progreso">
          <ProgressBar
            value={a.horas_cursadas}
            max={a.horas_totales}
            label={`Horas de ${a.nombre}`}
            tone={a.horas_cursadas >= a.horas_totales ? 'ok' : 'sol'}
          />
          <span className="num subtle">
            {Math.round(a.horas_cursadas)} / {a.horas_totales} h
          </span>
        </div>
      ),
    },
    {
      key: 'acciones',
      header: 'Acciones',
      align: 'end',
      render: (a) => (
        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditando(a)} aria-label={`Actualizar horas de ${a.nombre}`}>
          Horas
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Formación en Empresas"
        description={
          esAdmin
            ? 'Alumnado de todos los ciclos en prácticas y su avance respecto a las 500 horas.'
            : 'Tu alumnado tutorizado en prácticas y su avance respecto a las 500 horas.'
        }
      />

      {loading ? (
        <Skeleton lines={6} height={22} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : alumnos.length === 0 ? (
        <EmptyState icon={Briefcase} title="No tienes alumnado FEM asignado">
          Cuando se te asigne alumnado en prácticas como tutor o tutora, aparecerá aquí.
        </EmptyState>
      ) : (
        <>
          <dl className="cifras">
            <div>
              <dt>Alumnado</dt>
              <dd className="num">{alumnos.length}</dd>
            </div>
            <div>
              <dt>En prácticas ahora</dt>
              <dd className="num">{enPracticas.length}</dd>
            </div>
            <div>
              <dt>Empresas</dt>
              <dd className="num">{empresas}</dd>
            </div>
            <div className="cifra-destacada">
              <dt>Avance medio</dt>
              <dd className="num">{Math.round(mediaPct)}%</dd>
            </div>
          </dl>

          <div className="toolbar">
            <Tabs<Filtro>
              label="Estado del seguimiento"
              value={filtro}
              onChange={setFiltro}
              items={[
                { value: 'todos', label: 'Todos', count: alumnos.length },
                { value: 'activo', label: 'En prácticas', count: enPracticas.length },
                { value: 'pendiente', label: 'Sin empezar', count: alumnos.filter((a) => a.estado === 'pendiente').length },
                { value: 'finalizado', label: 'Finalizadas', count: alumnos.filter((a) => a.estado === 'finalizado').length },
              ]}
            />
            <label className="search">
              <Search size={16} aria-hidden />
              <span className="sr-only">Buscar alumno o empresa</span>
              <input type="search" placeholder="Alumno o empresa" value={texto} onChange={(e) => setTexto(e.target.value)} />
            </label>
          </div>

          <div className="panel panel-flush">
            <DataTable
              rows={filtrados}
              columns={columns}
              rowKey={(a) => a.id}
              caption="Alumnado en Formación en Empresas"
              initialSort={{ key: 'nombre', dir: 'asc' }}
              empty={<EmptyState icon={Search} title="Nadie coincide con el filtro" compact />}
            />
          </div>
        </>
      )}

      <Panel title="Mapa de empresas colaboradoras">
        <EmptyState icon={MapPinned} title="Disponible próximamente" compact>
          El mapa con las empresas activas e inactivas necesita su ubicación, que la API aún no guarda.
        </EmptyState>
      </Panel>

      <HorasModal
        alumno={editando}
        onClose={() => setEditando(null)}
        onSaved={(a) => {
          setData((prev) => (prev ?? []).map((x) => (x.id === a.id ? a : x)))
          toast.ok(`Horas de ${a.nombre} actualizadas`)
        }}
        onError={(m) => toast.error(m)}
      />
    </>
  )
}

function HorasModal({
  alumno,
  onClose,
  onSaved,
  onError,
}: {
  alumno: FemAlumno | null
  onClose: () => void
  onSaved: (a: FemAlumno) => void
  onError: (m: string) => void
}) {
  return (
    <Modal open={alumno !== null} onClose={onClose} title="Actualizar horas" description={alumno?.nombre} size="sm">
      {alumno && <HorasForm key={alumno.id} alumno={alumno} onClose={onClose} onSaved={onSaved} onError={onError} />}
    </Modal>
  )
}

function HorasForm({
  alumno,
  onClose,
  onSaved,
  onError,
}: {
  alumno: FemAlumno
  onClose: () => void
  onSaved: (a: FemAlumno) => void
  onError: (m: string) => void
}) {
  const [valor, setValor] = useState(String(alumno.horas_cursadas))
  const [enviando, setEnviando] = useState(false)
  const n = Number(valor)
  const invalido = valor === '' || Number.isNaN(n) || n < 0 || n > alumno.horas_totales
  const error = valor !== '' && invalido ? `Debe estar entre 0 y ${alumno.horas_totales} horas.` : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (invalido) return
    setEnviando(true)
    try {
      onSaved(await patchFemHoras(alumno.id, n))
      onClose()
    } catch (err) {
      onError(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <Field label="Horas cursadas" error={error} hint={`De un total de ${alumno.horas_totales} horas`}>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={alumno.horas_totales}
          step="0.5"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          autoFocus
        />
      </Field>
      {!invalido && (
        <div className="stack-sm">
          <ProgressBar value={n} max={alumno.horas_totales} label="Avance resultante" tone={n >= alumno.horas_totales ? 'ok' : 'sol'} />
          <p className="subtle num">{Math.round((n / alumno.horas_totales) * 100)}% completado</p>
        </div>
      )}
      <div className="form-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={enviando} disabled={invalido}>
          Guardar horas
        </Button>
      </div>
    </form>
  )
}
