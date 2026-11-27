import { CirclePlay } from 'lucide-react'
import { Link } from 'react-router'
import { useUser } from '../auth/auth-context'
import { PageHeader } from '../components/layout/PageHeader'
import { ButtonLink } from '../components/ui/Button'
import { Panel } from '../components/ui/Panel'
import { primerNombre } from '../lib/format'
import { VIDEOS_MODULO } from '../lib/onboarding'
import { navegacionPara } from '../lib/navigation'
import { puede } from '../lib/permissions'

/** Guía de primeros pasos: una secuencia real de tareas para empezar a usar la intranet. */
export function BienvenidaPage() {
  const user = useUser()
  const pasos = [
    {
      titulo: 'Revisa tus datos',
      texto: 'Comprueba tu nombre, DNI y teléfono: se usan para rellenar los documentos que generes.',
      to: '/perfil',
      cta: 'Ir a mi perfil',
    },
    {
      titulo: 'Consulta tu horario',
      texto: 'Tus clases, guardias y horas de reducción de la semana. En Inicio verás siempre tu día.',
      to: '/horario',
      cta: 'Ver mi horario',
    },
    {
      titulo: 'Lee el tablón',
      texto: 'Los anuncios destacados aparecen arriba; los de tu departamento se distinguen de los generales.',
      to: '/anuncios',
      cta: 'Abrir el tablón',
    },
    {
      titulo: 'Pide lo que necesites',
      texto: 'Averías del aula, material o difusión de una actividad: todo va por Solicitudes y puedes seguir su estado.',
      to: '/solicitudes',
      cta: 'Ver solicitudes',
    },
    ...(puede(user.roles, 'retrasos.registrar')
      ? [
          {
            titulo: 'Registra los retrasos',
            texto: 'Elige al alumno, confirma la hora y el módulo. En segundos.',
            to: '/retrasos',
            cta: 'Registrar un retraso',
          },
        ]
      : []),
  ]

  const modulos = navegacionPara(user.roles)
    .flatMap((g) => g.modulos)
    .filter((m) => m.disponible && m.id !== 'inicio' && m.id !== 'bienvenida')

  return (
    <>
      <PageHeader
        title={`Te damos la bienvenida, ${primerNombre(user.name)}`}
        description="Cinco minutos para conocer la intranet del IES Ramón Arcas."
      />
      <ol className="pasos">
        {pasos.map((p, i) => (
          <li key={p.to} className="paso">
            <span className="paso-num num" aria-hidden>
              {i + 1}
            </span>
            <div className="grow">
              <h2 className="paso-titulo">{p.titulo}</h2>
              <p className="muted">{p.texto}</p>
            </div>
            <ButtonLink to={p.to} size="sm">
              {p.cta}
            </ButtonLink>
          </li>
        ))}
      </ol>

      <Panel title="Vídeos explicativos" description="Un vídeo corto por módulo con lo esencial para empezar">
        <ul className="videos">
          {modulos.map((m) => {
            const Icon = m.icon
            const video = VIDEOS_MODULO[m.id]
            return (
              <li key={m.id} className="video">
                <Icon size={18} aria-hidden className="video-icono" />
                <div className="grow">
                  <Link to={m.path}>{m.label}</Link>
                  {video && <p className="subtle video-guion">{video.guion}</p>}
                </div>
                {video?.url ? (
                  <a className="video-estado" href={video.url} target="_blank" rel="noopener noreferrer">
                    <CirclePlay size={15} aria-hidden /> Ver vídeo ({video.duracion})
                  </a>
                ) : (
                  <span className="subtle video-estado">
                    <CirclePlay size={15} aria-hidden /> {video ? `${video.duracion}, próximamente` : 'Próximamente'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Panel>
    </>
  )
}
