import { CalendarDays, Users } from 'lucide-react'
import { useState } from 'react'
import { DiaTimeline } from '../components/DiaTimeline'
import { PageHeader } from '../components/layout/PageHeader'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Panel } from '../components/ui/Panel'
import { Tabs } from '../components/ui/Tabs'
import { useApi } from '../hooks/useApi'
import { MQ, useMediaQuery } from '../hooks/useMediaQuery'
import { minutos, plural } from '../lib/format'
import { bloquesDelDia, describirBloque, rangoSemana, resumenSemana } from '../lib/horario'
import { claveDia, DIAS_SEMANA } from '../lib/labels'
import { fetchMiHorario } from '../services/usuarios'
import type { Horario } from '../services/types'

const PX_POR_MIN = 1.25

export function HorarioPage() {
  const { data, error, loading, reload } = useApi(fetchMiHorario)
  const isMobile = useMediaQuery(MQ.movil)
  const hoy = claveDia()
  const resumen = resumenSemana(data)
  const vacio = data !== null && resumen.clases + resumen.guardias + resumen.reducciones === 0

  return (
    <>
      <PageHeader
        title="Mi horario"
        description={
          data && !vacio
            ? `${plural(resumen.clases, 'clase')}, ${plural(resumen.guardias, 'guardia')} y ${plural(
                resumen.reducciones,
                'hora de reducción',
                'horas de reducción',
              )} a la semana.`
            : 'Tu horario semanal de clases, guardias y reducciones.'
        }
      />

      {loading ? (
        <Skeleton lines={8} height={28} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : vacio || !data ? (
        <EmptyState icon={CalendarDays} title="Tu horario está vacío">
          Jefatura de estudios todavía no ha cargado tus horas.
        </EmptyState>
      ) : isMobile ? (
        <HorarioDia horario={data} hoy={hoy} />
      ) : (
        <HorarioSemana horario={data} hoy={hoy} />
      )}

      <Panel
        title="Comparar horarios"
        description="Encontrar huecos libres comunes con otros docentes para convocar reuniones."
      >
        <EmptyState icon={Users} title="Disponible próximamente" compact>
          El comparador necesita consultar el horario de otros docentes, algo que la API todavía no permite.
        </EmptyState>
      </Panel>
    </>
  )
}

function HorarioSemana({ horario, hoy }: { horario: Horario; hoy: string | null }) {
  const { inicio, fin } = rangoSemana(horario)
  const alto = (fin - inicio) * PX_POR_MIN
  const horas: number[] = []
  for (let m = Math.ceil(inicio / 60) * 60; m <= fin; m += 60) horas.push(m)

  return (
    <div className="panel panel-flush semana" role="table" aria-label="Horario semanal">
      <div className="semana-head" role="row">
        <span role="columnheader" className="semana-corner" aria-label="Hora" />
        {DIAS_SEMANA.map((d) => (
          <span
            key={d.key}
            role="columnheader"
            className={['semana-dia', d.key === hoy && 'is-hoy'].filter(Boolean).join(' ')}
          >
            {d.label}
            {d.key === hoy && <span className="semana-hoy">Hoy</span>}
          </span>
        ))}
      </div>
      <div className="semana-body" role="row" style={{ height: alto }}>
        <div className="semana-horas" role="rowheader" aria-hidden>
          {horas.map((m) => (
            <span key={m} style={{ top: (m - inicio) * PX_POR_MIN }}>
              {String(m / 60).padStart(2, '0')}:00
            </span>
          ))}
        </div>
        {DIAS_SEMANA.map((d) => (
          <div
            key={d.key}
            role="cell"
            aria-label={d.label}
            className={['semana-col', d.key === hoy && 'is-hoy'].filter(Boolean).join(' ')}
          >
            {horas.map((m) => (
              <span key={m} className="semana-linea" style={{ top: (m - inicio) * PX_POR_MIN }} aria-hidden />
            ))}
            {bloquesDelDia(horario, d.key).map((b) => {
              const top = (minutos(b.inicio) - inicio) * PX_POR_MIN
              const h = (minutos(b.fin) - minutos(b.inicio)) * PX_POR_MIN
              return (
                <div
                  key={`${b.inicio}-${b.fin}`}
                  className={`semana-bloque dia-${b.tipo}`}
                  style={{ top, height: h }}
                  title={`${b.inicio}–${b.fin} ${describirBloque(b)}`}
                >
                  <span className="dia-title">{describirBloque(b)}</span>
                  <span className="dia-meta">
                    {b.inicio}–{b.fin}
                    {b.grupo ? `, ${b.grupo}` : ''}
                    {b.aula ? `, ${b.aula}` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function HorarioDia({ horario, hoy }: { horario: Horario; hoy: string | null }) {
  const [dia, setDia] = useState<string>(hoy ?? 'lunes')
  const bloques = bloquesDelDia(horario, dia)
  return (
    <div className="stack">
      <Tabs
        label="Día de la semana"
        value={dia}
        onChange={setDia}
        className="tabs-fill"
        items={DIAS_SEMANA.map((d) => ({ value: d.key, label: d.corto }))}
      />
      {bloques.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin horas este día" compact />
      ) : (
        <DiaTimeline bloques={bloques} esHoy={dia === hoy} />
      )}
    </div>
  )
}
