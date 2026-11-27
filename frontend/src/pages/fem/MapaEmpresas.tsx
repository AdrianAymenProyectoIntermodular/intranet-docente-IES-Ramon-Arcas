/**
 * Mapa de empresas colaboradoras (Leaflet + teselas de OpenStreetMap).
 * Se carga de forma diferida para no engordar el resto de la PWA.
 */
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapPinOff } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import type { FemEmpresa } from '../../services/types'

// Lorca, centro de la comarca.
const CENTRO: [number, number] = [37.68, -1.7]

/** Activa: círculo relleno con marca; inactiva: cuadrado hueco. La forma distingue sin depender del color. */
function icono(activa: boolean, seleccionada: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span class="marcador ${activa ? 'marcador-activa' : 'marcador-inactiva'}${seleccionada ? ' is-sel' : ''}" aria-hidden="true"></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  })
}

/** Ajusta la vista a las empresas visibles y vuela a la seleccionada. */
function Encuadre({ empresas, seleccion }: { empresas: FemEmpresa[]; seleccion: string | null }) {
  const map = useMap()
  const claveVisibles = empresas.map((e) => e.id).join(',')
  useEffect(() => {
    const puntos = empresas.map((e) => [e.lat as number, e.lon as number] as [number, number])
    if (puntos.length === 0) map.setView(CENTRO, 10)
    else if (puntos.length === 1) map.setView(puntos[0], 13)
    else map.fitBounds(L.latLngBounds(puntos), { padding: [36, 36], maxZoom: 13 })
    // Solo cuando cambia el conjunto visible (filtros), no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveVisibles, map])
  useEffect(() => {
    const e = empresas.find((x) => x.id === seleccion)
    if (e) map.flyTo([e.lat as number, e.lon as number], Math.max(map.getZoom(), 13), { duration: 0.6 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion, map])
  return null
}

export default function MapaEmpresas({
  empresas,
  seleccion,
  onSeleccion,
}: {
  empresas: FemEmpresa[]
  seleccion: string | null
  onSeleccion: (id: string | null) => void
}) {
  const ubicadas = useMemo(() => empresas.filter((e) => e.lat !== null && e.lon !== null), [empresas])
  const sinUbicar = empresas.length - ubicadas.length
  const marcadores = useRef(new Map<string, L.Marker>())

  useEffect(() => {
    if (seleccion) marcadores.current.get(seleccion)?.openPopup()
  }, [seleccion])

  return (
    <div className="mapa">
      <MapContainer center={CENTRO} zoom={10} scrollWheelZoom className="mapa-leaflet" aria-label="Mapa de empresas colaboradoras">
        <TileLayer
          attribution='&copy; colaboradores de <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Encuadre empresas={ubicadas} seleccion={seleccion} />
        {ubicadas.map((e) => (
          <Marker
            key={e.id}
            position={[e.lat as number, e.lon as number]}
            icon={icono(e.activa, e.id === seleccion)}
            title={`${e.nombre} (${e.activa ? 'activa' : 'inactiva'})`}
            alt={`${e.nombre}, ${e.activa ? 'activa' : 'inactiva'}`}
            ref={(m) => {
              if (m) marcadores.current.set(e.id, m)
              else marcadores.current.delete(e.id)
            }}
            eventHandlers={{ click: () => onSeleccion(e.id) }}
          >
            <Popup>
              <div className="popup">
                <strong>{e.nombre}</strong>
                <span>
                  {e.direccion}, {e.municipio}
                </span>
                <span>{e.ciclos.join(', ') || 'Sin ciclos'}</span>
                <span>
                  {e.activa ? 'Activa' : 'Inactiva'}, {e.alumnos} {e.alumnos === 1 ? 'alumno' : 'alumnos'} en prácticas
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="mapa-pie">
        <ul className="leyenda" aria-label="Leyenda del mapa">
          <li>
            <span className="marcador marcador-activa marcador-mini" aria-hidden /> Activa
          </li>
          <li>
            <span className="marcador marcador-inactiva marcador-mini" aria-hidden /> Inactiva
          </li>
        </ul>
        {sinUbicar > 0 && (
          <span className="text-aviso">
            <MapPinOff size={14} aria-hidden /> {sinUbicar} sin ubicar en el mapa
          </span>
        )}
      </div>
    </div>
  )
}
