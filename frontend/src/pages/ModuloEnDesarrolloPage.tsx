import { Construction } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { ButtonLink } from '../components/ui/Button'
import type { Modulo } from '../lib/navigation'
import { MODULOS_EN_DESARROLLO } from '../lib/navigation'

/** Módulo sin API todavía: explica qué hará y cuándo llega, sin datos de ejemplo. */
export function ModuloEnDesarrolloPage({ modulo }: { modulo: Modulo }) {
  const Icon = modulo.icon
  const otros = MODULOS_EN_DESARROLLO.filter((m) => m.id !== modulo.id && m.fase === modulo.fase)
  return (
    <>
      <PageHeader title={modulo.label} />
      <section className="en-desarrollo">
        <span className="en-desarrollo-icon" aria-hidden>
          <Icon size={28} />
        </span>
        <div className="stack-sm">
          <p className="en-desarrollo-fase">
            <Construction size={15} aria-hidden /> En desarrollo, {modulo.fase?.toLowerCase()}
          </p>
          <p className="en-desarrollo-texto">{modulo.descripcion}</p>
          <p className="muted">
            Este módulo aún no tiene conexión con el servidor, así que no muestra datos. Cuando esté listo aparecerá
            aquí sin que tengas que hacer nada.
          </p>
        </div>
        <ButtonLink to="/" variant="secondary">
          Volver al inicio
        </ButtonLink>
      </section>
      {otros.length > 0 && (
        <p className="subtle">
          También llegan en esta fase: {otros.map((m) => m.label.toLowerCase()).join(', ')}.
        </p>
      )}
    </>
  )
}
