export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  )
}

/** Carga a pantalla de contenido (no bloquea el layout). */
export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="loading-block" role="status">
      <Spinner size={22} />
      <span>{label}</span>
    </div>
  )
}
