import { useEffect, useState } from 'react'
import { horaLocal, minutos } from '../lib/format'
import { describirBloque } from '../lib/horario'
import type { BloqueHorario } from '../services/types'

/**
 * "Tu día": franja horizontal con los bloques reales del horario y un marcador de "ahora".
 * En móvil se convierte en una lista vertical (ver CSS .dia-*).
 */
export function DiaTimeline({ bloques, esHoy }: { bloques: BloqueHorario[]; esHoy: boolean }) {
  const [ahora, setAhora] = useState(() => new Date())

  useEffect(() => {
    if (!esHoy) return
    const t = window.setInterval(() => setAhora(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [esHoy])

  const inicio = Math.min(...bloques.map((b) => minutos(b.inicio)))
  const fin = Math.max(...bloques.map((b) => minutos(b.fin)))
  const span = Math.max(fin - inicio, 1)
  const now = ahora.getHours() * 60 + ahora.getMinutes()
  const nowPct = ((now - inicio) / span) * 100
  const mostrarAhora = esHoy && now >= inicio && now <= fin

  // Marcas de hora en punto dentro del rango.
  const marcas: number[] = []
  for (let m = Math.ceil(inicio / 60) * 60; m <= fin; m += 60) marcas.push(m)

  return (
    <div className="dia">
      <div className="dia-track" role="list" aria-label="Bloques de hoy">
        {marcas.map((m) => (
          <span
            key={m}
            className="dia-tick"
            style={{ left: `${((m - inicio) / span) * 100}%` }}
            aria-hidden
          >
            {String(m / 60).padStart(2, '0')}:00
          </span>
        ))}
        {bloques.map((b) => {
          const ini = minutos(b.inicio)
          const end = minutos(b.fin)
          const enCurso = esHoy && now >= ini && now < end
          const pasado = esHoy && now >= end
          return (
            <div
              key={`${b.inicio}-${b.fin}`}
              role="listitem"
              className={[
                'dia-block',
                `dia-${b.tipo}`,
                enCurso && 'is-now',
                pasado && 'is-past',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${((ini - inicio) / span) * 100}%`, width: `${((end - ini) / span) * 100}%` }}
              aria-current={enCurso ? 'time' : undefined}
            >
              <span className="dia-time num">
                {b.inicio}–{b.fin}
              </span>
              <span className="dia-title">{describirBloque(b)}</span>
              {(b.grupo || b.aula) && (
                <span className="dia-meta">{[b.grupo, b.aula].filter(Boolean).join(', ')}</span>
              )}
            </div>
          )
        })}
        {mostrarAhora && (
          <div className="dia-now" style={{ left: `${nowPct}%` }} aria-label={`Ahora, ${horaLocal(ahora)}`}>
            <span className="dia-now-label num">{horaLocal(ahora)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
