import { Inbox, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useUser } from '../../auth/auth-context'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Checkbox, Select } from '../../components/ui/Field'
import { Tabs } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toast-context'
import { useApi } from '../../hooks/useApi'
import { useDirectorio } from '../../hooks/useDirectorio'
import { formatFecha, formatRelativa, parseApiDate } from '../../lib/format'
import { ESTADO_TICKET, ORDEN_ESTADOS, TIPO_TICKET } from '../../lib/labels'
import { listTickets } from '../../services/modulos'
import type { Ticket, TicketEstado, TicketTipo } from '../../services/types'
import { NuevaSolicitudModal } from './NuevaSolicitudModal'
import { TicketDetalle } from './TicketDetalle'

type FiltroTipo = 'todas' | TicketTipo
const TIPOS: FiltroTipo[] = ['todas', 'rmi', 'compras', 'rrss', 'otro']

export function SolicitudesPage() {
  const user = useUser()
  const toast = useToast()
  const dir = useDirectorio()
  const [params, setParams] = useSearchParams()
  const { data, error, loading, reload, setData } = useApi(() => listTickets())
  const [texto, setTexto] = useState('')

  const tipo = (TIPOS.includes(params.get('tipo') as FiltroTipo) ? params.get('tipo') : 'todas') as FiltroTipo
  const estado = (params.get('estado') ?? '') as TicketEstado | ''
  const soloMias = params.get('mias') === '1'
  const ticketId = params.get('ticket')
  const nueva = params.get('nueva') === '1'

  /** Actualiza varios parámetros de la URL en una sola navegación. */
  const setParamsMany = (cambios: Record<string, string | null>, replace = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(cambios)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace },
    )
  }
  const setParam = (key: string, value: string | null) => setParamsMany({ [key]: value }, key !== 'ticket')

  const tickets = useMemo(() => data ?? [], [data])
  const filtrados = useMemo(() => {
    const q = texto.trim().toLowerCase()
    return tickets.filter((t) => {
      if (tipo !== 'todas' && t.tipo !== tipo) return false
      if (estado && t.estado !== estado) return false
      if (soloMias && t.solicitante_id !== user.id && t.asignado_id !== user.id) return false
      if (q && !`${t.titulo} ${t.descripcion ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [tickets, tipo, estado, soloMias, texto, user.id])

  const seleccionado = tickets.find((t) => t.id === ticketId) ?? null

  const actualizar = (t: Ticket) => setData((prev) => (prev ?? []).map((x) => (x.id === t.id ? t : x)))

  const columns: Column<Ticket>[] = [
    {
      key: 'titulo',
      header: 'Solicitud',
      sortValue: (t) => t.titulo,
      render: (t) => (
        <span className="cell-main">
          <span className="cell-title">{t.titulo}</span>
          {t.descripcion && <span className="subtle cell-sub">{t.descripcion.split('\n')[0]}</span>}
        </span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo',
      sortValue: (t) => TIPO_TICKET[t.tipo].corto,
      render: (t) => <span className={`tipo-chip tipo-${t.tipo}`}>{TIPO_TICKET[t.tipo].corto}</span>,
    },
    {
      key: 'estado',
      header: 'Estado',
      sortValue: (t) => ORDEN_ESTADOS.indexOf(t.estado),
      render: (t) => (
        <Badge tone={ESTADO_TICKET[t.estado].tone} dot>
          {ESTADO_TICKET[t.estado].label}
        </Badge>
      ),
    },
    {
      key: 'responsable',
      header: 'Responsable',
      hideOnMobile: true,
      sortValue: (t) => dir.nombre(t.asignado_id),
      render: (t) => <span className={t.asignado_id ? undefined : 'subtle'}>{dir.nombre(t.asignado_id)}</span>,
    },
    {
      key: 'fecha',
      header: 'Creada',
      align: 'end',
      sortValue: (t) => parseApiDate(t.creado_en)?.getTime() ?? 0,
      render: (t) => (
        <span className="subtle num" title={formatFecha(t.creado_en)}>
          {formatRelativa(t.creado_en)}
        </span>
      ),
    },
  ]

  const esRrss = tipo === 'rrss'

  return (
    <>
      <PageHeader
        title={esRrss ? 'Publicaciones en RRSS' : 'Solicitudes'}
        description={
          esRrss
            ? 'Pide la difusión de una actividad. El equipo de RRSS la revisa y la publica a mano: nada se publica automáticamente.'
            : 'Incidencias RMI, compras y publicaciones en redes: una sola cola con el mismo seguimiento.'
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setParam('nueva', '1')}>
            {esRrss ? 'Nueva publicación' : 'Nueva solicitud'}
          </Button>
        }
      />

      <Tabs<FiltroTipo>
        label="Tipo de solicitud"
        value={tipo}
        onChange={(v) => setParam('tipo', v === 'todas' ? null : v)}
        items={TIPOS.map((t) => ({
          value: t,
          label: t === 'todas' ? 'Todas' : TIPO_TICKET[t].corto,
          count: t === 'todas' ? tickets.length : tickets.filter((x) => x.tipo === t).length,
        }))}
      />

      <div className="toolbar">
        <label className="search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Buscar solicitudes</span>
          <input
            type="search"
            placeholder="Buscar por título o descripción"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </label>
        <Select
          aria-label="Filtrar por estado"
          value={estado}
          onChange={(e) => setParam('estado', e.target.value)}
          className="select-inline"
        >
          <option value="">Todos los estados</option>
          {ORDEN_ESTADOS.map((s) => (
            <option key={s} value={s}>
              {ESTADO_TICKET[s].label}
            </option>
          ))}
        </Select>
        <Checkbox
          label="Solo las mías"
          checked={soloMias}
          onChange={(e) => setParam('mias', e.target.checked ? '1' : null)}
        />
      </div>

      {loading ? (
        <Skeleton lines={6} height={20} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : (
        <div className="panel panel-flush">
          <DataTable
            rows={filtrados}
            columns={columns}
            rowKey={(t) => t.id}
            caption="Solicitudes"
            initialSort={{ key: 'fecha', dir: 'desc' }}
            onRowClick={(t) => setParam('ticket', t.id)}
            empty={
              <EmptyState
                icon={Inbox}
                title={tickets.length === 0 ? 'No hay solicitudes todavía' : 'Ninguna solicitud coincide con los filtros'}
                action={
                  <Button icon={Plus} onClick={() => setParam('nueva', '1')}>
                    Crear solicitud
                  </Button>
                }
              >
                {tickets.length === 0
                  ? 'Cuando alguien comunique una incidencia o pida material, aparecerá aquí.'
                  : 'Cambia el tipo, el estado o el texto de búsqueda.'}
              </EmptyState>
            }
          />
        </div>
      )}

      <TicketDetalle
        ticket={seleccionado}
        onClose={() => setParam('ticket', null)}
        onUpdated={actualizar}
      />

      {nueva && (
      <NuevaSolicitudModal
        open
        tipoInicial={tipo === 'todas' ? null : tipo}
        onClose={() => setParam('nueva', null)}
        onCreated={(t) => {
          setData((prev) => [t, ...(prev ?? [])])
          toast.ok('Solicitud enviada')
          // Cierra el formulario y abre el detalle de lo recién creado.
          setParamsMany({ nueva: null, ticket: t.id }, false)
        }}
      />
      )}
    </>
  )
}
