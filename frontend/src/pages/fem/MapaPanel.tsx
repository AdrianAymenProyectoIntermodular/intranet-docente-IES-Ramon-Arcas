import { Building2, MapPin } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState } from '../../components/ui/Feedback'
import { LoadingBlock } from '../../components/ui/Spinner'
import type { ApiState } from '../../hooks/useApi'
import { filtrarEmpresas, type FiltrosEmpresas } from '../../lib/fem'
import type { FemEmpresa } from '../../services/types'
import { FiltrosEmpresasBar } from './EmpresasPanel'

const MapaEmpresas = lazy(() => import('./MapaEmpresas'))

export function MapaPanel({
  empresas,
  filtros,
  onFiltros,
}: {
  empresas: ApiState<FemEmpresa[]>
  filtros: FiltrosEmpresas
  onFiltros: (f: FiltrosEmpresas) => void
}) {
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const lista = empresas.data ?? []
  const visibles = filtrarEmpresas(lista, filtros)

  if (empresas.error) return <ErrorState message={empresas.error} onRetry={() => void empresas.reload()} />

  return (
    <div className="stack">
      <FiltrosEmpresasBar empresas={lista} filtros={filtros} onChange={onFiltros} />
      <div className="grid-mapa">
        <div className="panel panel-flush">
          {empresas.loading ? (
            <LoadingBlock label="Cargando empresas…" />
          ) : (
            <Suspense fallback={<LoadingBlock label="Cargando el mapa…" />}>
              <MapaEmpresas empresas={visibles} seleccion={seleccion} onSeleccion={setSeleccion} />
            </Suspense>
          )}
        </div>
        <div className="panel mapa-lista">
          {visibles.length === 0 ? (
            <EmptyState icon={Building2} title="Ninguna empresa coincide" compact />
          ) : (
            <ul>
              {visibles.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={['mapa-item', seleccion === e.id && 'is-active'].filter(Boolean).join(' ')}
                    aria-pressed={seleccion === e.id}
                    disabled={e.lat === null}
                    onClick={() => setSeleccion(e.id)}
                  >
                    <MapPin size={16} aria-hidden className={e.activa ? 'mapa-item-activa' : 'mapa-item-inactiva'} />
                    <span className="grow">
                      <span className="mapa-item-nombre">{e.nombre}</span>
                      <span className="subtle">
                        {e.municipio}, {e.alumnos} en prácticas
                      </span>
                    </span>
                    {!e.activa && <Badge tone="neutro">Inactiva</Badge>}
                    {e.lat === null && <Badge tone="aviso">Sin ubicar</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
