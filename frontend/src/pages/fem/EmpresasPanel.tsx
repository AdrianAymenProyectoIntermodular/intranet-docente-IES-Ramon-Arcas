import { Building2, MapPinOff, Pencil, Plus, RefreshCw, Search } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useUser } from '../../auth/auth-context'
import { Badge } from '../../components/ui/Badge'
import { Button, IconButton } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Checkbox, Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast-context'
import type { ApiState } from '../../hooks/useApi'
import { errorMessage } from '../../services/api'
import { createFemEmpresa, geocodificarFemEmpresa, patchFemEmpresa } from '../../services/modulos'
import type { FemEmpresa, FemEmpresaPayload } from '../../services/types'
import { filtrarEmpresas, type FiltrosEmpresas } from '../../lib/fem'

/** Filtros compartidos por la tabla y el mapa de empresas. */
export function FiltrosEmpresasBar({
  empresas,
  filtros,
  onChange,
}: {
  empresas: FemEmpresa[]
  filtros: FiltrosEmpresas
  onChange: (f: FiltrosEmpresas) => void
}) {
  const ciclos = useMemo(() => [...new Set(empresas.flatMap((e) => e.ciclos))].sort(), [empresas])
  const municipios = useMemo(() => [...new Set(empresas.map((e) => e.municipio))].sort(), [empresas])
  return (
    <div className="toolbar">
      <label className="search">
        <Search size={16} aria-hidden />
        <span className="sr-only">Buscar empresa</span>
        <input
          type="search"
          placeholder="Empresa o dirección"
          value={filtros.texto}
          onChange={(e) => onChange({ ...filtros, texto: e.target.value })}
        />
      </label>
      <Select
        aria-label="Ciclo formativo"
        className="select-inline"
        value={filtros.ciclo}
        onChange={(e) => onChange({ ...filtros, ciclo: e.target.value })}
      >
        <option value="">Todos los ciclos</option>
        {ciclos.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Municipio"
        className="select-inline"
        value={filtros.municipio}
        onChange={(e) => onChange({ ...filtros, municipio: e.target.value })}
      >
        <option value="">Todos los municipios</option>
        {municipios.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </Select>
    </div>
  )
}

export function EmpresasPanel({
  empresas,
  filtros,
  onFiltros,
}: {
  empresas: ApiState<FemEmpresa[]>
  filtros: FiltrosEmpresas
  onFiltros: (f: FiltrosEmpresas) => void
}) {
  const user = useUser()
  const toast = useToast()
  const esAdmin = user.roles.includes('admin')
  const [editando, setEditando] = useState<FemEmpresa | 'nueva' | null>(null)

  const lista = empresas.data ?? []
  const filtradas = filtrarEmpresas(lista, filtros)

  const reemplazar = (e: FemEmpresa) =>
    empresas.setData((prev) => {
      const actuales = prev ?? []
      return actuales.some((x) => x.id === e.id) ? actuales.map((x) => (x.id === e.id ? e : x)) : [...actuales, e]
    })

  const reintentar = async (e: FemEmpresa) => {
    try {
      const r = await geocodificarFemEmpresa(e.id)
      reemplazar(r)
      if (r.geocodificada) toast.ok(`${r.nombre} ya está en el mapa`)
      else toast.error('Sigue sin encontrarse la dirección')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const columns: Column<FemEmpresa>[] = [
    {
      key: 'nombre',
      header: 'Empresa',
      sortValue: (e) => e.nombre,
      render: (e) => (
        <span className="cell-main">
          <span className="cell-title">{e.nombre}</span>
          <span className="subtle cell-sub">{e.direccion}</span>
        </span>
      ),
    },
    { key: 'municipio', header: 'Municipio', sortValue: (e) => e.municipio, render: (e) => e.municipio },
    {
      key: 'ciclos',
      header: 'Ciclos',
      hideOnMobile: true,
      render: (e) => (
        <span className="chips">
          {e.ciclos.map((c) => (
            <span key={c} className="chip">
              {c}
            </span>
          ))}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortValue: (e) => (e.activa ? 0 : 1),
      render: (e) => (
        <Badge tone={e.activa ? 'ok' : 'neutro'} dot>
          {e.activa ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'alumnos',
      header: 'En prácticas',
      align: 'end',
      sortValue: (e) => e.alumnos,
      render: (e) => <span className="num">{e.alumnos}</span>,
    },
    {
      key: 'mapa',
      header: 'Mapa',
      align: 'end',
      render: (e) =>
        e.geocodificada ? (
          <span className="subtle">Ubicada</span>
        ) : (
          <span className="row row-end">
            <span className="text-aviso">
              <MapPinOff size={14} aria-hidden /> Sin ubicar
            </span>
            {esAdmin && <IconButton icon={RefreshCw} size="sm" label={`Reintentar ubicación de ${e.nombre}`} onClick={() => void reintentar(e)} />}
          </span>
        ),
    },
    ...(esAdmin
      ? [
          {
            key: 'acciones',
            header: 'Acciones',
            align: 'end' as const,
            render: (e: FemEmpresa) => (
              <IconButton icon={Pencil} size="sm" label={`Editar ${e.nombre}`} onClick={() => setEditando(e)} />
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="stack">
      <div className="row-between">
        <FiltrosEmpresasBar empresas={lista} filtros={filtros} onChange={onFiltros} />
        {esAdmin && (
          <Button variant="primary" icon={Plus} onClick={() => setEditando('nueva')}>
            Nueva empresa
          </Button>
        )}
      </div>
      {empresas.loading ? (
        <Skeleton lines={6} height={22} />
      ) : empresas.error ? (
        <ErrorState message={empresas.error} onRetry={() => void empresas.reload()} />
      ) : (
        <div className="panel panel-flush">
          <DataTable
            rows={filtradas}
            columns={columns}
            rowKey={(e) => e.id}
            caption="Empresas colaboradoras"
            initialSort={{ key: 'nombre', dir: 'asc' }}
            empty={
              <EmptyState icon={Building2} title={lista.length ? 'Ninguna empresa coincide' : 'Sin empresas registradas'} compact>
                {esAdmin && !lista.length ? 'Da de alta la primera empresa colaboradora.' : undefined}
              </EmptyState>
            }
          />
        </div>
      )}
      <Modal
        open={editando !== null}
        onClose={() => setEditando(null)}
        title={editando === 'nueva' ? 'Nueva empresa' : 'Editar empresa'}
        description="La dirección se sitúa en el mapa con OpenStreetMap."
      >
        {editando !== null && (
          <EmpresaForm
            key={editando === 'nueva' ? 'nueva' : editando.id}
            empresa={editando === 'nueva' ? null : editando}
            onClose={() => setEditando(null)}
            onSaved={(e) => {
              reemplazar(e)
              setEditando(null)
              if (e.geocodificada) toast.ok(`${e.nombre} guardada y ubicada en el mapa`)
              else toast.error(`${e.nombre} guardada, pero no se encontró la dirección en el mapa`)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function EmpresaForm({
  empresa,
  onClose,
  onSaved,
}: {
  empresa: FemEmpresa | null
  onClose: () => void
  onSaved: (e: FemEmpresa) => void
}) {
  const [nombre, setNombre] = useState(empresa?.nombre ?? '')
  const [direccion, setDireccion] = useState(empresa?.direccion ?? '')
  const [municipio, setMunicipio] = useState(empresa?.municipio ?? 'Lorca')
  const [ciclos, setCiclos] = useState((empresa?.ciclos ?? []).join(', '))
  const [activa, setActiva] = useState(empresa?.activa ?? true)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!nombre.trim()) errs.nombre = 'Indica el nombre.'
    if (!direccion.trim()) errs.direccion = 'Indica la dirección.'
    if (!municipio.trim()) errs.municipio = 'Indica el municipio.'
    setErrores(errs)
    if (Object.keys(errs).length) return
    const payload: FemEmpresaPayload = {
      nombre: nombre.trim(),
      direccion: direccion.trim(),
      municipio: municipio.trim(),
      ciclos: [...new Set(ciclos.split(',').map((c) => c.trim()).filter(Boolean))],
      activa,
    }
    setEnviando(true)
    setErrorApi(null)
    try {
      onSaved(empresa ? await patchFemEmpresa(empresa.id, payload) : await createFemEmpresa(payload))
    } catch (err) {
      setErrorApi(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <Field label="Nombre" required error={errores.nombre}>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
      </Field>
      <Field label="Dirección" required error={errores.direccion} hint="Calle y número, o polígono y nave">
        <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
      </Field>
      <div className="form-row">
        <Field label="Municipio" required error={errores.municipio}>
          <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
        </Field>
        <Field label="Ciclos" hint="Separados por comas: DAW, SMR">
          <Input value={ciclos} onChange={(e) => setCiclos(e.target.value)} />
        </Field>
      </div>
      <Checkbox label="Empresa activa" description="Acoge alumnado este curso" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
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
          {empresa ? 'Guardar cambios' : 'Dar de alta'}
        </Button>
      </div>
    </form>
  )
}
