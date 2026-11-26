import { FileSearch, FilterX } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { DataTable, Pagination, type Column } from '../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Field, Input, Select } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { useApi } from '../hooks/useApi'
import { formatFechaHora } from '../lib/format'
import { ACCION_AUDITORIA } from '../lib/labels'
import { listAuditoria } from '../services/modulos'
import type { RegistroAuditoria } from '../services/types'

const RECURSOS: Record<string, string> = {
  auth: 'Sesión',
  usuario: 'Usuario',
  retraso: 'Retraso',
  alumno: 'Alumno',
}

const LIMIT = 15

export function AuditoriaPage() {
  const [accion, setAccion] = useState('')
  const [recurso, setRecurso] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [page, setPage] = useState(1)
  const [detalle, setDetalle] = useState<RegistroAuditoria | null>(null)

  const rangoInvalido = Boolean(desde && hasta && desde > hasta)
  const { data, error, loading, reload } = useApi(
    () =>
      rangoInvalido
        ? Promise.resolve(null)
        : listAuditoria({
            page,
            limit: LIMIT,
            accion: accion || undefined,
            recurso_tipo: recurso || undefined,
            desde: desde ? new Date(`${desde}T00:00:00`).toISOString() : undefined,
            hasta: hasta ? new Date(`${hasta}T23:59:59`).toISOString() : undefined,
          }),
    [page, accion, recurso, desde, hasta, rangoInvalido],
  )

  const cambiar = (fn: () => void) => {
    fn()
    setPage(1)
  }
  const hayFiltros = Boolean(accion || recurso || desde || hasta)

  const columns: Column<RegistroAuditoria>[] = [
    {
      key: 'fecha',
      header: 'Fecha',
      render: (r) => <span className="num">{formatFechaHora(r.fecha)}</span>,
    },
    {
      key: 'usuario',
      header: 'Usuario',
      render: (r) =>
        r.usuario_id === 'anonymous' ? (
          <span className="subtle">Sin identificar</span>
        ) : (
          (r.usuario_nombre ?? <span className="subtle">…{r.usuario_id.slice(-6)}</span>)
        ),
    },
    {
      key: 'accion',
      header: 'Acción',
      render: (r) => (
        <span className={r.accion.endsWith('failed') ? 'text-error' : undefined}>{ACCION_AUDITORIA[r.accion] ?? r.accion}</span>
      ),
    },
    {
      key: 'recurso',
      header: 'Recurso',
      hideOnMobile: true,
      render: (r) => (
        <span>
          {RECURSOS[r.recurso_tipo] ?? r.recurso_tipo}
          {r.recurso_id && <span className="subtle num"> …{r.recurso_id.slice(-6)}</span>}
        </span>
      ),
    },
    {
      key: 'detalle',
      header: 'Detalle',
      align: 'end',
      render: (r) =>
        r.detalle ? (
          <Button size="sm" variant="ghost" onClick={() => setDetalle(r)}>
            Ver
          </Button>
        ) : (
          <span className="subtle">—</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Registro de acciones relevantes: quién hizo qué y cuándo. Solo lectura."
      />

      <div className="filtros">
        <Field label="Acción">
          <Select value={accion} onChange={(e) => cambiar(() => setAccion(e.target.value))}>
            <option value="">Todas</option>
            {Object.entries(ACCION_AUDITORIA).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Recurso">
          <Select value={recurso} onChange={(e) => cambiar(() => setRecurso(e.target.value))}>
            <option value="">Todos</option>
            {Object.entries(RECURSOS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Desde">
          <Input type="date" value={desde} max={hasta || undefined} onChange={(e) => cambiar(() => setDesde(e.target.value))} />
        </Field>
        <Field label="Hasta" error={rangoInvalido ? 'Debe ser posterior a «Desde».' : null}>
          <Input type="date" value={hasta} min={desde || undefined} onChange={(e) => cambiar(() => setHasta(e.target.value))} />
        </Field>
        {hayFiltros && (
          <Button
            variant="ghost"
            icon={FilterX}
            className="filtros-reset"
            onClick={() => {
              setAccion('')
              setRecurso('')
              setDesde('')
              setHasta('')
              setPage(1)
            }}
          >
            Quitar filtros
          </Button>
        )}
      </div>

      {loading && !data ? (
        <Skeleton lines={8} height={20} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <div className={['panel', 'panel-flush', loading && 'is-refreshing'].filter(Boolean).join(' ')}>
          <DataTable
            rows={data?.items ?? []}
            columns={columns}
            rowKey={(r) => r.id}
            caption="Registros de auditoría"
            empty={
              <EmptyState icon={FileSearch} title="No hay registros" compact>
                {hayFiltros ? 'Ningún registro coincide con los filtros.' : 'Aún no se ha registrado ninguna acción.'}
              </EmptyState>
            }
          />
          {data && (
            <div className="panel-pad">
              <Pagination page={data.page} limit={data.limit} total={data.total} onChange={setPage} />
            </div>
          )}
        </div>
      )}

      <Modal
        open={detalle !== null}
        onClose={() => setDetalle(null)}
        title={detalle ? (ACCION_AUDITORIA[detalle.accion] ?? detalle.accion) : 'Detalle'}
        description={detalle ? formatFechaHora(detalle.fecha) : undefined}
      >
        {detalle && <pre className="json">{JSON.stringify(detalle.detalle, null, 2)}</pre>}
      </Modal>
    </>
  )
}
