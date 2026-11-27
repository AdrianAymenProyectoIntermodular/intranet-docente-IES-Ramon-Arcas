import { Save } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '../../components/ui/Button'
import { DataTable } from '../../components/ui/DataTable'
import { ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Field, Input } from '../../components/ui/Field'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toast-context'
import { useApi } from '../../hooks/useApi'
import { formatFechaHora } from '../../lib/format'
import { errorMessage } from '../../services/api'
import { fetchConfiguracionDashboard, fetchDashboardRetrasos, putConfiguracionDashboard } from '../../services/modulos'
import type { DashboardRetrasos } from '../../services/types'

type AlumnoSobreUmbral = DashboardRetrasos['alumnado_sobre_umbral'][number]

/**
 * KPI 3: retrasos por grupo y módulo, y alumnado que alcanza el umbral de "tasa alta".
 * El umbral lo fija dirección aquí mismo (memoria 5.11: nunca un valor fijo en código).
 */
export function RetrasosPanel({ recarga }: { recarga: number }) {
  const toast = useToast()
  const retrasos = useApi(fetchDashboardRetrasos, [recarga])
  const config = useApi(fetchConfiguracionDashboard, [recarga])
  const [umbral, setUmbral] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const valorUmbral = umbral ?? String(config.data?.umbral_retrasos ?? '')
  const numero = Number(valorUmbral)
  const valido = Number.isInteger(numero) && numero >= 1 && numero <= 100
  const cambiado = config.data !== null && valido && numero !== config.data.umbral_retrasos

  const guardar = async (e: FormEvent) => {
    e.preventDefault()
    if (!valido) return
    setGuardando(true)
    try {
      config.setData(await putConfiguracionDashboard(numero))
      setUmbral(null)
      await retrasos.reload()
      toast.ok('Umbral de retrasos actualizado')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setGuardando(false)
    }
  }

  const d = retrasos.data
  const maxGrupo = Math.max(1, ...(d?.por_grupo.map((g) => g.retrasos) ?? []))
  const maxModulo = Math.max(1, ...(d?.por_modulo.map((m) => m.retrasos) ?? []))

  return (
    <Panel
      title="Retrasos por grupo"
      description={
        d
          ? `Curso ${d.curso_escolar}: ${d.total} retrasos. Tasa alta a partir de ${d.umbral} retrasos por alumno.`
          : 'Retrasos del curso escolar y alumnado sobre el umbral de tasa alta'
      }
    >
      <div className="stack">
        <form className="umbral-form" onSubmit={(e) => void guardar(e)} noValidate>
          <Field
            label="Umbral de tasa alta"
            hint={
              config.data?.actualizado_por_nombre
                ? `Nº de retrasos en el curso. Último cambio: ${config.data.actualizado_por_nombre}, ${formatFechaHora(config.data.actualizado_en)}`
                : 'Nº de retrasos en el curso a partir del cual se considera tasa alta'
            }
            error={valorUmbral && !valido ? 'Entre 1 y 100.' : undefined}
          >
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={valorUmbral}
              disabled={config.loading || config.error !== null}
              onChange={(e) => setUmbral(e.target.value)}
            />
          </Field>
          <Button type="submit" icon={Save} loading={guardando} disabled={!cambiado}>
            Guardar umbral
          </Button>
        </form>

        {retrasos.loading ? (
          <Skeleton lines={5} />
        ) : retrasos.error ? (
          <ErrorState message={retrasos.error} onRetry={() => void retrasos.reload()} />
        ) : !d || d.total === 0 ? (
          <p className="subtle">No hay retrasos registrados en este curso escolar.</p>
        ) : (
          <>
            <div className="grid-2">
              <div className="stack-sm">
                <h3 className="barras-titulo">Por grupo</h3>
                <ul className="barras" aria-label="Retrasos por grupo">
                  {d.por_grupo.map((g) => (
                    <li key={g.grupo} className="barra-fila">
                      <span className="barra-label">{g.grupo}</span>
                      <span
                        className="barra-pista"
                        title={`${g.grupo}: ${g.retrasos} retrasos de ${g.alumnos_con_retrasos} alumnos, ${g.alumnos_sobre_umbral} sobre el umbral`}
                      >
                        <span className="barra" style={{ width: `${(g.retrasos / maxGrupo) * 100}%` }} />
                      </span>
                      <span className="barra-valor num">
                        {g.retrasos}
                        <span className={g.alumnos_sobre_umbral ? 'text-error' : 'subtle'}>
                          {' '}
                          ({g.alumnos_sobre_umbral} sobre umbral)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="stack-sm">
                <h3 className="barras-titulo">Por módulo</h3>
                <ul className="barras" aria-label="Retrasos por módulo">
                  {d.por_modulo.slice(0, 8).map((m) => (
                    <li key={m.modulo} className="barra-fila">
                      <span className="barra-label">{m.modulo}</span>
                      <span className="barra-pista" title={`${m.modulo}: ${m.retrasos} retrasos`}>
                        <span className="barra" style={{ width: `${(m.retrasos / maxModulo) * 100}%` }} />
                      </span>
                      <span className="barra-valor num">{m.retrasos}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <DataTable<AlumnoSobreUmbral>
              caption={`Alumnado con ${d.umbral} retrasos o más`}
              rows={d.alumnado_sobre_umbral}
              rowKey={(a) => a.alumno_id}
              initialSort={{ key: 'retrasos', dir: 'desc' }}
              empty={<p className="subtle">Ningún alumno alcanza el umbral de tasa alta.</p>}
              columns={[
                { key: 'nombre', header: 'Alumno', render: (a) => a.nombre, sortValue: (a) => a.nombre },
                { key: 'grupo', header: 'Grupo', render: (a) => a.grupo, sortValue: (a) => a.grupo },
                {
                  key: 'retrasos',
                  header: 'Retrasos',
                  align: 'end',
                  render: (a) => <span className="num">{a.retrasos}</span>,
                  sortValue: (a) => a.retrasos,
                },
              ]}
            />
          </>
        )}
      </div>
    </Panel>
  )
}
