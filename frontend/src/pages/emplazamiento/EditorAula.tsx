import { Eraser, Save, Shuffle, Trash2, UserMinus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useUser } from '../../auth/auth-context'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Field, Input, Select } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../components/ui/toast-context'
import { clave, DISTRIBUCIONES, MAX_LADO, plantilla, repartir, tonoEquipo } from '../../lib/aula'
import { errorMessage } from '../../services/api'
import { createEmplazamiento, deleteEmplazamiento, updateEmplazamiento } from '../../services/modulos'
import type { Alumno, Distribucion, Emplazamiento, Puesto } from '../../services/types'

function nombreCorto(nombre: string): string {
  const [n, a] = nombre.split(' ')
  return a ? `${n} ${a[0]}.` : n
}

export function EditorAula({
  inicial,
  grupo,
  modulo,
  alumnos,
  onGuardado,
  onBorrado,
}: {
  inicial: Emplazamiento | null
  grupo: string
  modulo: string
  alumnos: Alumno[]
  onGuardado: (e: Emplazamiento) => void
  onBorrado: (id: string) => void
}) {
  const user = useUser()
  const toast = useToast()
  const [nombre, setNombre] = useState(inicial?.nombre ?? 'Nuevo diseño')
  const [distribucion, setDistribucion] = useState<Distribucion>(inicial?.distribucion ?? 'parejas')
  const [filas, setFilas] = useState(inicial?.filas ?? 5)
  const [columnas, setColumnas] = useState(inicial?.columnas ?? 8)
  const [puestos, setPuestos] = useState<Puesto[]>(() => inicial?.puestos ?? plantilla('parejas', 5, 8))
  const [editando, setEditando] = useState<{ fila: number; columna: number } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const puedeEditar = !inicial || user.roles.includes('admin') || inicial.autor_id === user.id

  const porClave = useMemo(() => new Map(puestos.map((p) => [clave(p.fila, p.columna), p])), [puestos])
  const alumnoPorId = useMemo(() => new Map(alumnos.map((a) => [a.id, a])), [alumnos])
  const sentados = new Set(puestos.map((p) => p.alumno_id).filter(Boolean))
  const sinSentar = alumnos.filter((a) => !sentados.has(a.id))

  /** Cambia la plantilla conservando el alumnado de los puestos que siguen existiendo. */
  const aplicarPlantilla = (d: Distribucion, f: number, c: number) => {
    const base = d === 'personalizada' ? puestos.filter((p) => p.fila < f && p.columna < c) : plantilla(d, f, c)
    setPuestos(base.map((p) => ({ ...p, alumno_id: porClave.get(clave(p.fila, p.columna))?.alumno_id ?? null })))
  }

  const actualizarPuesto = (fila: number, columna: number, cambio: Partial<Puesto> | null) => {
    setPuestos((prev) => {
      const k = clave(fila, columna)
      const existe = prev.some((p) => clave(p.fila, p.columna) === k)
      if (cambio === null) return prev.filter((p) => clave(p.fila, p.columna) !== k)
      if (!existe) return [...prev, { fila, columna, alumno_id: null, equipo: null, ...cambio }]
      return prev.map((p) => (clave(p.fila, p.columna) === k ? { ...p, ...cambio } : p))
    })
  }

  const guardar = async () => {
    if (!nombre.trim()) {
      toast.error('Ponle un nombre al diseño.')
      return
    }
    setGuardando(true)
    const payload = { nombre: nombre.trim(), grupo, modulo, distribucion, filas, columnas, puestos }
    try {
      const guardado = inicial ? await updateEmplazamiento(inicial.id, payload) : await createEmplazamiento(payload)
      onGuardado(guardado)
      toast.ok('Diseño guardado')
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async () => {
    if (!inicial) return
    try {
      await deleteEmplazamiento(inicial.id)
      onBorrado(inicial.id)
      toast.ok('Diseño borrado')
    } catch (err) {
      toast.error(errorMessage(err))
      throw err
    }
  }

  const celdaActual = editando ? porClave.get(clave(editando.fila, editando.columna)) : undefined
  const lado = (v: string) => Math.max(1, Math.min(MAX_LADO, Number(v) || 1))

  return (
    <div className="editor-aula">
      <div className="editor-controles">
        <Field label="Nombre del diseño">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} disabled={!puedeEditar} />
        </Field>
        <Field label="Distribución" hint={DISTRIBUCIONES.find((d) => d.value === distribucion)?.descripcion}>
          <Select
            value={distribucion}
            disabled={!puedeEditar}
            onChange={(e) => {
              const d = e.target.value as Distribucion
              setDistribucion(d)
              aplicarPlantilla(d, filas, columnas)
            }}
          >
            {DISTRIBUCIONES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="form-row editor-lados">
          <Field label="Filas">
            <Input
              type="number"
              min={1}
              max={MAX_LADO}
              value={filas}
              disabled={!puedeEditar}
              onChange={(e) => {
                const f = lado(e.target.value)
                setFilas(f)
                aplicarPlantilla(distribucion, f, columnas)
              }}
            />
          </Field>
          <Field label="Columnas">
            <Input
              type="number"
              min={1}
              max={MAX_LADO}
              value={columnas}
              disabled={!puedeEditar}
              onChange={(e) => {
                const c = lado(e.target.value)
                setColumnas(c)
                aplicarPlantilla(distribucion, filas, c)
              }}
            />
          </Field>
        </div>
      </div>

      <div className="aula" aria-label={`Aula de ${grupo}, ${modulo}`}>
        <div className="aula-pizarra">Pizarra y mesa del profesorado</div>
        <div className="aula-rejilla" style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}>
          {Array.from({ length: filas * columnas }, (_, i) => {
            const fila = Math.floor(i / columnas)
            const columna = i % columnas
            const p = porClave.get(clave(fila, columna))
            if (!p) {
              return distribucion === 'personalizada' && puedeEditar ? (
                <button
                  key={i}
                  type="button"
                  className="aula-hueco aula-hueco-editable"
                  aria-label={`Añadir pupitre en fila ${fila + 1}, columna ${columna + 1}`}
                  onClick={() => actualizarPuesto(fila, columna, {})}
                />
              ) : (
                <span key={i} className="aula-hueco" aria-hidden />
              )
            }
            const alumno = p.alumno_id ? alumnoPorId.get(p.alumno_id) : undefined
            const tono = tonoEquipo(p.equipo)
            return (
              <button
                key={i}
                type="button"
                className={['pupitre', alumno && 'is-ocupado', tono !== null && `equipo-t${tono}`].filter(Boolean).join(' ')}
                disabled={!puedeEditar}
                onClick={() => setEditando({ fila, columna })}
                aria-label={`Fila ${fila + 1}, columna ${columna + 1}: ${alumno ? alumno.nombre : 'libre'}${p.equipo ? `, ${p.equipo}` : ''}`}
              >
                <span className="pupitre-nombre">{alumno ? nombreCorto(alumno.nombre) : 'Libre'}</span>
                {p.equipo && <span className="pupitre-equipo">{p.equipo}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="editor-pie">
        <p className="subtle">
          {alumnos.length - sinSentar.length} de {alumnos.length} alumnos sentados en {puestos.length} pupitres.
          {sinSentar.length > 0 && puestos.length - sentados.size < sinSentar.length && ' Faltan pupitres para todo el grupo.'}
        </p>
        {puedeEditar && (
          <div className="row">
            <Button size="sm" icon={Shuffle} onClick={() => setPuestos((prev) => repartir(prev, alumnos.map((a) => a.id)))}>
              Repartir al azar
            </Button>
            <Button size="sm" variant="ghost" icon={Eraser} onClick={() => setPuestos((prev) => prev.map((p) => ({ ...p, alumno_id: null })))}>
              Vaciar
            </Button>
            {inicial && (
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => setConfirmarBorrado(true)}>
                Borrar
              </Button>
            )}
            <Button variant="primary" icon={Save} loading={guardando} onClick={() => void guardar()} className="editor-guardar">
              Guardar diseño
            </Button>
          </div>
        )}
        {!puedeEditar && <p className="subtle">Diseño de {inicial?.autor_nombre ?? 'otro docente'}: solo lectura.</p>}
      </div>

      <Modal
        open={editando !== null}
        onClose={() => setEditando(null)}
        title={editando ? `Pupitre de la fila ${editando.fila + 1}, columna ${editando.columna + 1}` : 'Pupitre'}
        size="sm"
      >
        {editando && celdaActual && (
          <div className="stack">
            <Field label="Equipo" hint="Opcional, p. ej. Equipo 2">
              <Input
                value={celdaActual.equipo ?? ''}
                maxLength={20}
                onChange={(e) => actualizarPuesto(editando.fila, editando.columna, { equipo: e.target.value || null })}
              />
            </Field>
            <div className="stack-sm">
              <span className="field-label">Sentar a</span>
              {sinSentar.length === 0 ? (
                <p className="subtle">Todo el grupo tiene sitio.</p>
              ) : (
                <ul className="picker-list picker-results">
                  {sinSentar.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="picker-item"
                        onClick={() => {
                          actualizarPuesto(editando.fila, editando.columna, { alumno_id: a.id })
                          setEditando(null)
                        }}
                      >
                        {a.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="row">
              {celdaActual.alumno_id && (
                <Button
                  size="sm"
                  icon={UserMinus}
                  onClick={() => {
                    actualizarPuesto(editando.fila, editando.columna, { alumno_id: null })
                    setEditando(null)
                  }}
                >
                  Dejar libre
                </Button>
              )}
              {distribucion === 'personalizada' && (
                <Button
                  size="sm"
                  variant="danger"
                  icon={Trash2}
                  onClick={() => {
                    actualizarPuesto(editando.fila, editando.columna, null)
                    setEditando(null)
                  }}
                >
                  Quitar pupitre
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmarBorrado}
        onClose={() => setConfirmarBorrado(false)}
        title="Borrar diseño"
        confirmLabel="Borrar"
        tone="danger"
        onConfirm={borrar}
      >
        Se borrará el diseño <strong>{inicial?.nombre}</strong>. No se puede deshacer.
      </ConfirmDialog>
    </div>
  )
}
