import {
  CalendarDays,
  Coffee,
  Inbox,
  Megaphone,
  Pin,
  Plus,
  Timer,
  UserCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useUser } from '../auth/auth-context'
import { DiaTimeline } from '../components/DiaTimeline'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState, ErrorState, Notice, Skeleton } from '../components/ui/Feedback'
import { Panel } from '../components/ui/Panel'
import { useApi, type ApiState } from '../hooks/useApi'
import { formatFechaLarga, formatRelativa, plural, primerNombre } from '../lib/format'
import { bloquesDelDia, describirBloque, siguienteDiaConClase } from '../lib/horario'
import { claveDia, ESTADO_TICKET, TIPO_TICKET } from '../lib/labels'
import { puede } from '../lib/permissions'
import { listAnuncios, listTickets } from '../services/modulos'
import type { Horario } from '../services/types'
import { fetchMiHorario, listUsuarios } from '../services/usuarios'

function saludo(d: Date): string {
  const h = d.getHours()
  if (h < 14) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

export function InicioPage() {
  const user = useUser()
  const [hoy] = useState(() => new Date())
  const horario = useApi(fetchMiHorario)
  const anuncios = useApi(() => listAnuncios())
  const tickets = useApi(() => listTickets())
  const esAdmin = puede(user.roles, 'usuarios.gestionar')
  const pendientes = useApi(
    () => (esAdmin ? listUsuarios({ estado: 'pendiente', limit: 1 }).then((r) => r.total) : Promise.resolve(0)),
    [esAdmin],
  )

  const misTickets = (tickets.data ?? []).filter((t) => t.solicitante_id === user.id && t.estado !== 'cerrado')
  const recientes = (anuncios.data ?? []).slice(0, 4)

  return (
    <>
      <PageHeader
        title={`${saludo(hoy)}, ${primerNombre(user.name)}`}
        description={formatFechaLarga(hoy)}
        actions={
          <>
            {puede(user.roles, 'retrasos.registrar') && (
              <ButtonLink to="/retrasos" icon={Timer}>
                Registrar retraso
              </ButtonLink>
            )}
            <ButtonLink to="/solicitudes?nueva=1" variant="primary" icon={Plus}>
              Nueva solicitud
            </ButtonLink>
          </>
        }
      />

      {esAdmin && (pendientes.data ?? 0) > 0 && (
        <Notice tone="sol" icon={UserCheck}>
          Hay {plural(pendientes.data ?? 0, 'cuenta pendiente', 'cuentas pendientes')} de aprobar.{' '}
          <Link to="/admin/usuarios?estado=pendiente">Revisar ahora</Link>
        </Notice>
      )}

      <TuDia horario={horario} hoy={hoy} />

      <div className="grid-2">
        <Panel
          title="Tablón"
          description="Lo último publicado para ti"
          actions={
            <Link to="/anuncios" className="panel-link">
              Ver todo
            </Link>
          }
        >
          {anuncios.loading ? (
            <Skeleton lines={4} />
          ) : anuncios.error ? (
            <ErrorState message={anuncios.error} onRetry={() => void anuncios.reload()} />
          ) : recientes.length === 0 ? (
            <EmptyState icon={Megaphone} title="No hay anuncios vigentes" compact />
          ) : (
            <ul className="feed-mini">
              {recientes.map((a) => (
                <li key={a.id}>
                  <Link to={`/anuncios#${a.id}`} className="feed-mini-item">
                    {a.fijado && <Pin size={14} aria-label="Destacado" className="feed-mini-pin" />}
                    <span className="grow">
                      <span className="feed-mini-title">{a.titulo}</span>
                      <span className="subtle">
                        {a.departamento ?? 'General'}, {formatRelativa(a.creado_en)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Mis solicitudes abiertas"
          description="Incidencias, compras y publicaciones que has pedido"
          actions={
            <Link to="/solicitudes?mias=1" className="panel-link">
              Ver todas
            </Link>
          }
        >
          {tickets.loading ? (
            <Skeleton lines={3} />
          ) : tickets.error ? (
            <ErrorState message={tickets.error} onRetry={() => void tickets.reload()} />
          ) : misTickets.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No tienes solicitudes abiertas"
              compact
              action={
                <ButtonLink to="/solicitudes?nueva=1" size="sm" icon={Plus}>
                  Crear solicitud
                </ButtonLink>
              }
            >
              ¿Algo no funciona en tu aula o necesitas material? Pídelo aquí.
            </EmptyState>
          ) : (
            <ul className="feed-mini">
              {misTickets.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link to={`/solicitudes?ticket=${t.id}`} className="feed-mini-item">
                    <span className="grow">
                      <span className="feed-mini-title">{t.titulo}</span>
                      <span className="subtle">
                        {TIPO_TICKET[t.tipo].corto}, {formatRelativa(t.creado_en)}
                      </span>
                    </span>
                    <Badge tone={ESTADO_TICKET[t.estado].tone} dot>
                      {ESTADO_TICKET[t.estado].label}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  )
}

function TuDia({ horario, hoy }: { horario: ApiState<Horario>; hoy: Date }) {
  const dia = claveDia(hoy)
  const bloques = bloquesDelDia(horario.data, dia)
  const ahora = hoy.getHours() * 60 + hoy.getMinutes()
  const siguiente = bloques.find((b) => {
    const [h, m] = b.inicio.split(':').map(Number)
    return h * 60 + m > ahora
  })
  const proximo = bloques.length === 0 ? siguienteDiaConClase(horario.data, hoy) : null

  return (
    <Panel
      className="panel-dia"
      title="Tu día"
      description={
        bloques.length
          ? siguiente
            ? `Siguiente: ${describirBloque(siguiente)} a las ${siguiente.inicio}${siguiente.aula ? ` en ${siguiente.aula}` : ''}`
            : 'Has terminado las horas de hoy'
          : undefined
      }
      actions={
        <Link to="/horario" className="panel-link">
          Semana completa
        </Link>
      }
    >
      {horario.loading ? (
        <Skeleton lines={2} height={56} />
      ) : horario.error ? (
        <ErrorState message={horario.error} onRetry={() => void horario.reload()} />
      ) : bloques.length > 0 ? (
        <>
          <DiaTimeline bloques={bloques} esHoy />
          <Leyenda />
        </>
      ) : (
        <EmptyState icon={dia ? Coffee : CalendarDays} title="Hoy no tienes horas asignadas" compact>
          {proximo
            ? `Tu próxima jornada es el ${formatFechaLarga(proximo.fecha).toLowerCase()}, desde las ${proximo.bloques[0].inicio}.`
            : 'Tu horario aún no tiene bloques. Consulta con jefatura de estudios.'}
        </EmptyState>
      )}
    </Panel>
  )
}

function Leyenda() {
  return (
    <ul className="leyenda" aria-label="Leyenda">
      <li>
        <span className="leyenda-swatch dia-clase" aria-hidden /> Clase
      </li>
      <li>
        <span className="leyenda-swatch dia-guardia" aria-hidden /> Guardia
      </li>
      <li>
        <span className="leyenda-swatch dia-reduccion" aria-hidden /> Reducción horaria
      </li>
    </ul>
  )
}
