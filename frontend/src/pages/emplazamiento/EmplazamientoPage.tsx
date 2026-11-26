import { Armchair, LayoutGrid, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/Feedback'
import { Field, Input, Select } from '../../components/ui/Field'
import { Panel } from '../../components/ui/Panel'
import { useApi } from '../../hooks/useApi'
import { formatRelativa } from '../../lib/format'
import { listAlumnos, listEmplazamientos } from '../../services/modulos'
import type { Emplazamiento } from '../../services/types'
import { fetchMiHorario } from '../../services/usuarios'
import { EditorAula } from './EditorAula'

export function EmplazamientoPage() {
  const horario = useApi(fetchMiHorario)
  const todos = useApi(() => listAlumnos())
  const [grupo, setGrupo] = useState('')
  const [modulo, setModulo] = useState('')
  // null = ninguno seleccionado; 'nuevo' = editor vacío.
  const [seleccion, setSeleccion] = useState<string | 'nuevo' | null>(null)

  const bloques = useMemo(() => Object.values(horario.data?.dias ?? {}).flat(), [horario.data])
  const grupos = useMemo(() => {
    const set = new Set<string>()
    for (const b of bloques) if (b.grupo) set.add(b.grupo)
    for (const a of todos.data ?? []) set.add(a.grupo)
    return [...set].sort()
  }, [bloques, todos.data])
  const modulos = useMemo(() => {
    const set = new Set<string>()
    for (const b of bloques) if (b.tipo === 'clase' && b.asignatura && (!grupo || b.grupo === grupo)) set.add(b.asignatura)
    return [...set].sort()
  }, [bloques, grupo])

  const listo = Boolean(grupo && modulo.trim())
  const disenos = useApi(
    () => (listo ? listEmplazamientos({ grupo, modulo: modulo.trim() }) : Promise.resolve([] as Emplazamiento[])),
    [grupo, modulo.trim(), listo],
  )
  const alumnos = useApi(() => (grupo ? listAlumnos({ grupo }) : Promise.resolve([])), [grupo])

  const actual = disenos.data?.find((d) => d.id === seleccion) ?? null

  return (
    <>
      <PageHeader
        title="Emplazamiento en el aula"
        description="Diseña cómo se sienta tu alumnado en cada clase: filas, parejas, grupos de trabajo o en U."
      />

      <div className="toolbar emplazamiento-filtros">
        <Field label="Grupo">
          <Select
            value={grupo}
            onChange={(e) => {
              setGrupo(e.target.value)
              setSeleccion(null)
            }}
          >
            <option value="">Elige un grupo</option>
            {grupos.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Módulo o asignatura" hint={modulos.length ? 'Sugerencias de tu horario' : undefined}>
          <Input
            value={modulo}
            list="modulos-aula"
            onChange={(e) => {
              setModulo(e.target.value)
              setSeleccion(null)
            }}
            placeholder="Matemáticas"
          />
        </Field>
        <datalist id="modulos-aula">
          {modulos.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>

      {!listo ? (
        <EmptyState icon={Armchair} title="Elige una clase">
          Selecciona grupo y módulo para ver sus diseños de aula o crear uno nuevo.
        </EmptyState>
      ) : (
        <div className="grid-emplazamiento">
          <Panel
            title="Diseños"
            actions={
              <Button size="sm" variant="primary" icon={Plus} onClick={() => setSeleccion('nuevo')}>
                Nuevo
              </Button>
            }
          >
            {disenos.loading ? (
              <Skeleton lines={3} />
            ) : disenos.error ? (
              <ErrorState message={disenos.error} onRetry={() => void disenos.reload()} />
            ) : (disenos.data ?? []).length === 0 ? (
              <EmptyState icon={LayoutGrid} title="Sin diseños" compact>
                Crea el primero para {grupo}.
              </EmptyState>
            ) : (
              <ul className="disenos">
                {(disenos.data ?? []).map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={['diseno', seleccion === d.id && 'is-active'].filter(Boolean).join(' ')}
                      aria-pressed={seleccion === d.id}
                      onClick={() => setSeleccion(d.id)}
                    >
                      <span className="diseno-nombre">{d.nombre}</span>
                      <span className="subtle">
                        {d.puestos.filter((p) => p.alumno_id).length} sentados, {d.autor_nombre ?? 'sin autor'},{' '}
                        {formatRelativa(d.actualizado_en)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="panel-aula">
            {seleccion === null ? (
              <EmptyState icon={Armchair} title="Elige un diseño o crea uno nuevo" compact />
            ) : alumnos.loading ? (
              <Skeleton lines={6} height={28} />
            ) : alumnos.error ? (
              <ErrorState message={alumnos.error} onRetry={() => void alumnos.reload()} />
            ) : (
              <EditorAula
                key={seleccion}
                inicial={seleccion === 'nuevo' ? null : actual}
                grupo={grupo}
                modulo={modulo.trim()}
                alumnos={alumnos.data ?? []}
                onGuardado={(e) => {
                  disenos.setData((prev) => [e, ...(prev ?? []).filter((x) => x.id !== e.id)])
                  setSeleccion(e.id)
                }}
                onBorrado={(id) => {
                  disenos.setData((prev) => (prev ?? []).filter((x) => x.id !== id))
                  setSeleccion(null)
                }}
              />
            )}
          </Panel>
        </div>
      )}
    </>
  )
}
