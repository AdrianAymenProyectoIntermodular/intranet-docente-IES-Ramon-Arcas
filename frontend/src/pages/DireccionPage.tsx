import { CircleCheck, CircleDashed, CircleDot, RefreshCw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/Button'
import { ErrorState, ProgressBar, Skeleton } from '../components/ui/Feedback'
import { Panel } from '../components/ui/Panel'
import { useApi } from '../hooks/useApi'
import { TIPO_TICKET } from '../lib/labels'
import { fetchDashboardFem, fetchKpis, listTickets } from '../services/modulos'
import type { ProporcionActivas, Ticket, TicketTipo } from '../services/types'

type EstadoKpi = 'disponible' | 'parcial' | 'pendiente'

const ESTADO_KPI: Record<EstadoKpi, { label: string; icon: LucideIcon }> = {
  disponible: { label: 'Disponible', icon: CircleCheck },
  parcial: { label: 'Parcial', icon: CircleDot },
  pendiente: { label: 'Pendiente de datos', icon: CircleDashed },
}

/** Los 9 indicadores de la memoria (apartado 5.11) y qué datos reales existen hoy. */
const INDICADORES: { nombre: string; estado: EstadoKpi; nota: string }[] = [
  { nombre: 'Tasa de abandono por curso', estado: 'pendiente', nota: 'Requiere matrícula del alumnado.' },
  { nombre: 'Rendimiento académico por grupo', estado: 'pendiente', nota: 'Requiere calificaciones.' },
  {
    nombre: 'Retrasos por grupo y alumnado sobre el umbral',
    estado: 'pendiente',
    nota: 'Los retrasos ya se registran; falta la agregación y el umbral configurable por dirección.',
  },
  { nombre: 'Ausencias del profesorado', estado: 'pendiente', nota: 'Llega con el módulo de ausencias (Fase 3).' },
  {
    nombre: 'Empresas FEM activas por municipio y ciclo',
    estado: 'disponible',
    nota: 'Sobre las empresas colaboradoras registradas.',
  },
  { nombre: 'Horas FEM cursadas sobre 500', estado: 'disponible', nota: 'Con todo el alumnado FEM registrado.' },
  {
    nombre: 'Publicaciones RRSS y porcentaje publicado',
    estado: 'parcial',
    nota: 'Total y finalizadas; el desglose por departamento necesita ese dato en la solicitud.',
  },
  { nombre: 'Uso del aula de convivencia', estado: 'pendiente', nota: 'Módulo no iniciado.' },
  { nombre: 'Comisiones de servicio gestionadas', estado: 'pendiente', nota: 'Módulo no iniciado.' },
]

export function DireccionPage() {
  const kpis = useApi(fetchKpis)
  const tickets = useApi(() => listTickets())
  const fem = useApi(fetchDashboardFem)

  const recargar = () => {
    void kpis.reload()
    void tickets.reload()
    void fem.reload()
  }

  return (
    <>
      <PageHeader
        title="Indicadores del centro"
        description="Datos reales disponibles hoy. Los indicadores sin fuente de datos se marcan como pendientes."
        actions={
          <Button icon={RefreshCw} onClick={recargar} loading={kpis.loading}>
            Actualizar
          </Button>
        }
      />

      {kpis.error ? (
        <ErrorState message={kpis.error} onRetry={() => void kpis.reload()} />
      ) : (
        <dl className="cifras cifras-grandes">
          <Cifra label="Solicitudes abiertas" valor={kpis.data?.tickets_abiertos} nota="Pendientes o en curso" />
          <Cifra label="Docentes activos" valor={kpis.data?.docentes_activos} nota="Cuentas con acceso" />
          <Cifra label="Alumnado FEM en prácticas" valor={kpis.data?.alumnos_fem_activos} nota="Todos los ciclos" />
          <Cifra label="Ausencias hoy" valor={null} nota="Sin datos hasta que exista el módulo de ausencias" />
        </dl>
      )}

      <div className="grid-2">
        <Panel title="Solicitudes por tipo" description="Total registrado y cuántas siguen abiertas">
          {tickets.loading ? (
            <Skeleton lines={4} />
          ) : tickets.error ? (
            <ErrorState message={tickets.error} onRetry={() => void tickets.reload()} />
          ) : (
            <BarrasTipo tickets={tickets.data ?? []} />
          )}
        </Panel>

        <Panel title="Seguimiento" description="Indicadores calculados con datos actuales">
          <div className="stack">
            <RrssResumen tickets={tickets.data ?? []} cargando={tickets.loading} />
            {fem.loading ? (
              <Skeleton lines={2} />
            ) : fem.error ? (
              <ErrorState message={fem.error} onRetry={() => void fem.reload()} />
            ) : fem.data && fem.data.horas.previstas > 0 ? (
              <div className="indicador">
                <div className="row-between">
                  <span>Horas FEM cursadas sobre las previstas</span>
                  <strong className="num">{Math.round(fem.data.horas.porcentaje)}%</strong>
                </div>
                <ProgressBar value={fem.data.horas.cursadas} max={fem.data.horas.previstas} label="Horas FEM cursadas" />
                <p className="subtle num">
                  {Math.round(fem.data.horas.cursadas).toLocaleString('es-ES')} de{' '}
                  {fem.data.horas.previstas.toLocaleString('es-ES')} horas ({fem.data.horas.alumnos} alumnos)
                </p>
              </div>
            ) : (
              <p className="subtle">No hay alumnado FEM registrado.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="Empresas FEM activas"
        description={
          fem.data
            ? `${fem.data.empresas_activas} de ${fem.data.empresas_total} empresas registradas (${fem.data.porcentaje_activas}%)`
            : 'Porcentaje de empresas activas sobre las registradas'
        }
      >
        {fem.loading ? (
          <Skeleton lines={5} />
        ) : fem.error ? (
          <ErrorState message={fem.error} onRetry={() => void fem.reload()} />
        ) : fem.data && fem.data.empresas_total > 0 ? (
          <div className="grid-2">
            <BarrasProporcion titulo="Por municipio" filas={fem.data.por_municipio} />
            <BarrasProporcion titulo="Por ciclo formativo" filas={fem.data.por_ciclo} />
          </div>
        ) : (
          <p className="subtle">No hay empresas colaboradoras registradas.</p>
        )}
      </Panel>

      <Panel title="Indicadores de la memoria del proyecto" description="Estado de cada indicador exigido al cuadro de mando">
        <ul className="indicadores">
          {INDICADORES.map((k) => {
            const e = ESTADO_KPI[k.estado]
            const Icon = e.icon
            return (
              <li key={k.nombre} className={`indicador-item kpi-${k.estado}`}>
                <Icon size={18} aria-hidden className="indicador-icon" />
                <span className="grow">
                  <span className="indicador-nombre">{k.nombre}</span>
                  <span className="subtle">{k.nota}</span>
                </span>
                <span className="indicador-estado">{e.label}</span>
              </li>
            )
          })}
        </ul>
      </Panel>
    </>
  )
}

function Cifra({ label, valor, nota }: { label: string; valor: number | null | undefined; nota: string }) {
  return (
    <div className={valor === null ? 'cifra-sin-datos' : undefined}>
      <dt>{label}</dt>
      <dd className="num">{valor === undefined ? <span className="skeleton skeleton-inline" /> : valor === null ? '—' : valor}</dd>
      <p className="subtle">{nota}</p>
    </div>
  )
}

/** Porcentaje de empresas activas por grupo; el valor va rotulado (no depende del color). */
function BarrasProporcion({ titulo, filas }: { titulo: string; filas: ProporcionActivas[] }) {
  return (
    <div className="stack-sm">
      <h3 className="barras-titulo">{titulo}</h3>
      <ul className="barras" aria-label={`Empresas activas ${titulo.toLowerCase()}`}>
        {filas.map((f) => (
          <li key={f.nombre} className="barra-fila">
            <span className="barra-label">{f.nombre}</span>
            <span className="barra-pista" title={`${f.nombre}: ${f.activas} de ${f.total} activas`}>
              <span className="barra" style={{ width: `${f.porcentaje}%` }} />
            </span>
            <span className="barra-valor num">
              {Math.round(f.porcentaje)}%<span className="subtle"> ({f.activas}/{f.total})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Barras horizontales de una sola serie; valor rotulado, sin depender del color. */
function BarrasTipo({ tickets }: { tickets: Ticket[] }) {
  const tipos: TicketTipo[] = ['rmi', 'compras', 'rrss', 'otro']
  const filas = tipos.map((t) => {
    const delTipo = tickets.filter((x) => x.tipo === t)
    return {
      tipo: t,
      total: delTipo.length,
      abiertas: delTipo.filter((x) => x.estado === 'abierto' || x.estado === 'en_proceso').length,
    }
  })
  const max = Math.max(1, ...filas.map((f) => f.total))
  return (
    <>
      <ul className="barras" aria-label="Solicitudes por tipo">
        {filas.map((f) => (
          <li key={f.tipo} className="barra-fila">
            <span className="barra-label">{TIPO_TICKET[f.tipo].label}</span>
            <span className="barra-pista" title={`${TIPO_TICKET[f.tipo].label}: ${f.total} en total, ${f.abiertas} abiertas`}>
              <span className="barra" style={{ width: `${(f.total / max) * 100}%` }} />
            </span>
            <span className="barra-valor num">
              {f.total}
              <span className="subtle"> ({f.abiertas} abiertas)</span>
            </span>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>Solicitudes por tipo</caption>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Total</th>
            <th>Abiertas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.tipo}>
              <td>{TIPO_TICKET[f.tipo].label}</td>
              <td>{f.total}</td>
              <td>{f.abiertas}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

function RrssResumen({ tickets, cargando }: { tickets: Ticket[]; cargando: boolean }) {
  if (cargando) return <Skeleton lines={2} />
  const rrss = tickets.filter((t) => t.tipo === 'rrss')
  const publicadas = rrss.filter((t) => t.estado === 'cerrado' || t.estado === 'resuelto').length
  return (
    <div className="indicador">
      <div className="row-between">
        <span>Publicaciones RRSS finalizadas</span>
        <strong className="num">{rrss.length ? Math.round((publicadas / rrss.length) * 100) : 0}%</strong>
      </div>
      <ProgressBar value={publicadas} max={Math.max(1, rrss.length)} label="Publicaciones RRSS finalizadas" />
      <p className="subtle num">
        {publicadas} de {rrss.length} solicitudes de publicación
      </p>
    </div>
  )
}
