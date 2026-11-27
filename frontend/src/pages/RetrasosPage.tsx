import { History, Search, ShieldCheck, Timer, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button, IconButton } from '../components/ui/Button'
import { Pagination } from '../components/ui/DataTable'
import { EmptyState, ErrorState, Notice, Skeleton } from '../components/ui/Feedback'
import { Field, Input, Select } from '../components/ui/Field'
import { Panel } from '../components/ui/Panel'
import { Spinner } from '../components/ui/Spinner'
import { useToast } from '../components/ui/toast-context'
import { useApi } from '../hooks/useApi'
import { cursoEscolar, formatFecha, horaLocal, isoLocal } from '../lib/format'
import { ApiError, errorMessage } from '../services/api'
import { createRetraso, listAlumnos, listRetrasosAlumno } from '../services/modulos'
import { fetchMiHorario } from '../services/usuarios'
import type { Alumno } from '../services/types'

export function RetrasosPage() {
  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [version, setVersion] = useState(0)

  return (
    <>
      <PageHeader
        title="Retrasos"
        description="Registra la llegada tarde de un alumno y consulta su histórico del curso."
      />
      <div className="grid-retrasos">
        <Panel title="Registrar retraso">
          <RegistroForm alumno={alumno} onAlumno={setAlumno} onRegistrado={() => setVersion((v) => v + 1)} />
        </Panel>
        <Panel
          title="Histórico del alumno"
          description={alumno ? `${alumno.nombre}, ${alumno.grupo}` : 'Elige un alumno para ver sus retrasos'}
        >
          {alumno ? (
            <Historico key={alumno.id} alumno={alumno} version={version} />
          ) : (
            <EmptyState icon={History} title="Ningún alumno seleccionado" compact>
              Busca al alumno en el formulario: su histórico aparecerá aquí.
            </EmptyState>
          )}
        </Panel>
      </div>
      <Notice tone="info" icon={ShieldCheck}>
        Son datos de menores: cada consulta del histórico queda registrada. Las estadísticas por grupo o módulo
        solo están disponibles para el equipo directivo.
      </Notice>
    </>
  )
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(t)
  }, [value, ms])
  return v
}

function AlumnoPicker({ onSelect }: { onSelect: (a: Alumno) => void }) {
  const [q, setQ] = useState('')
  const [grupo, setGrupo] = useState('')
  const qd = useDebounced(q)
  const grupos = useApi(() => listAlumnos().then((as) => [...new Set(as.map((a) => a.grupo))].sort()))
  const resultados = useApi(() => listAlumnos({ q: qd || undefined, grupo: grupo || undefined }), [qd, grupo])

  return (
    <div className="picker">
      <div className="form-row picker-filters">
        <label className="search">
          <Search size={16} aria-hidden />
          <span className="sr-only">Buscar alumno por nombre</span>
          <input
            type="search"
            placeholder="Nombre del alumno"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </label>
        <Select aria-label="Grupo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
          <option value="">Todos los grupos</option>
          {(grupos.data ?? []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
      </div>
      <div className="picker-results" aria-live="polite">
        {resultados.loading ? (
          <div className="picker-loading">
            <Spinner size={18} /> Buscando…
          </div>
        ) : resultados.error ? (
          <ErrorState message={resultados.error} onRetry={() => void resultados.reload()} />
        ) : (resultados.data ?? []).length === 0 ? (
          <p className="subtle picker-empty">No hay alumnos que coincidan.</p>
        ) : (
          <ul className="picker-list">
            {(resultados.data ?? []).map((a) => (
              <li key={a.id}>
                <button type="button" className="picker-item" onClick={() => onSelect(a)}>
                  <span className="grow">{a.nombre}</span>
                  <span className="subtle">{a.grupo}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function RegistroForm({
  alumno,
  onAlumno,
  onRegistrado,
}: {
  alumno: Alumno | null
  onAlumno: (a: Alumno | null) => void
  onRegistrado: () => void
}) {
  const toast = useToast()
  const horario = useApi(fetchMiHorario)
  const [fecha, setFecha] = useState(isoLocal())
  const [hora, setHora] = useState(horaLocal())
  const [modulo, setModulo] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)

  // Sugerencias de módulo a partir de las asignaturas de tu horario.
  const sugerencias = useMemo(() => {
    const set = new Set<string>()
    for (const bloques of Object.values(horario.data?.dias ?? {})) {
      for (const b of bloques) if (b.tipo === 'clase' && b.asignatura) set.add(b.asignatura)
    }
    return [...set].sort()
  }, [horario.data])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!alumno) errs.alumno = 'Elige un alumno.'
    if (!fecha) errs.fecha = 'Indica la fecha.'
    else if (fecha > isoLocal()) errs.fecha = 'La fecha no puede ser futura.'
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) errs.hora = 'Indica la hora (HH:MM).'
    if (!modulo.trim()) errs.modulo = 'Indica el módulo o asignatura.'
    setErrores(errs)
    if (Object.keys(errs).length || !alumno) return

    setEnviando(true)
    try {
      await createRetraso({ alumno_id: alumno.id, fecha, hora, modulo: modulo.trim() })
      toast.ok(`Retraso registrado: ${alumno.nombre}, ${hora}`)
      onRegistrado()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrores({ hora: err.message })
      else toast.error(errorMessage(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="form" onSubmit={(e) => void submit(e)} noValidate>
      <div className="field">
        <span className="field-label">
          Alumno <span className="field-required">*</span>
        </span>
        {alumno ? (
          <div className="alumno-chip">
            <UserRound size={18} aria-hidden />
            <span className="grow">
              <strong>{alumno.nombre}</strong>
              <span className="subtle">
                {' '}
                {alumno.grupo}, {alumno.curso}
              </span>
            </span>
            <IconButton icon={X} label="Cambiar de alumno" size="sm" onClick={() => onAlumno(null)} />
          </div>
        ) : (
          <AlumnoPicker onSelect={onAlumno} />
        )}
        {errores.alumno && (
          <p className="field-error" role="alert">
            {errores.alumno}
          </p>
        )}
      </div>
      <div className="form-row">
        <Field label="Fecha" required error={errores.fecha}>
          <Input type="date" value={fecha} max={isoLocal()} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        <Field label="Hora de llegada" required error={errores.hora}>
          <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Field>
      </div>
      <Field label="Módulo o asignatura" required error={errores.modulo} hint={sugerencias.length ? 'Sugerencias de tu horario' : undefined}>
        <Input value={modulo} onChange={(e) => setModulo(e.target.value)} list="modulos-horario" autoComplete="off" />
      </Field>
      <datalist id="modulos-horario">
        {sugerencias.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <Button type="submit" variant="primary" icon={Timer} loading={enviando} block>
        Registrar retraso
      </Button>
    </form>
  )
}

function Historico({ alumno, version }: { alumno: Alumno; version: number }) {
  const actual = cursoEscolar()
  const anterior = `${Number(actual.slice(0, 4)) - 1}/${actual.slice(0, 4)}`
  const [curso, setCurso] = useState(actual)
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useApi(
    () => listRetrasosAlumno(alumno.id, { curso_escolar: curso, page, limit: 8 }),
    [alumno.id, curso, page, version],
  )

  return (
    <div className="stack">
      <div className="row-between">
        <p className="historico-total">
          {data ? (
            <>
              <strong className="num">{data.total}</strong> {data.total === 1 ? 'retraso' : 'retrasos'} en {curso}
            </>
          ) : (
            ' '
          )}
        </p>
        <Select
          aria-label="Curso escolar"
          className="select-inline"
          value={curso}
          onChange={(e) => {
            setCurso(e.target.value)
            setPage(1)
          }}
        >
          <option value={actual}>Curso {actual}</option>
          <option value={anterior}>Curso {anterior}</option>
        </Select>
      </div>
      {loading && !data ? (
        <Skeleton lines={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void reload()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={History} title="Sin retrasos registrados" compact>
          No consta ningún retraso de {alumno.nombre.split(' ')[0]} en el curso {curso}.
        </EmptyState>
      ) : (
        <>
          <ol className="historico">
            {(data?.items ?? []).map((r) => (
              <li key={r.id} className="historico-item">
                <span className="historico-fecha num">{formatFecha(r.fecha)}</span>
                <span className="historico-hora num">{r.hora}</span>
                <span className="grow">{r.modulo}</span>
              </li>
            ))}
          </ol>
          {data && data.total > data.limit && (
            <Pagination page={data.page} limit={data.limit} total={data.total} onChange={setPage} />
          )}
        </>
      )}
    </div>
  )
}
