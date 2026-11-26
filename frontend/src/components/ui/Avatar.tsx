import { iniciales } from '../../lib/format'

/** Avatar de iniciales con tono estable derivado del nombre. */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  const tono = hash % 4
  return (
    <span
      className={`avatar avatar-t${tono}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {iniciales(name)}
    </span>
  )
}
