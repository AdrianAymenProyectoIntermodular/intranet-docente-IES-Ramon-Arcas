import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type TabItem<T extends string> = {
  value: T
  label: ReactNode
  count?: number
}

/**
 * Pestañas accesibles (role=tablist) con navegación por flechas.
 * Controla qué contenido se muestra; el panel lo pinta el llamador.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    let next = index
    if (e.key === 'ArrowRight') next = (index + 1) % items.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = items.length - 1
    else return
    e.preventDefault()
    refs.current[next]?.focus()
    onChange(items[next].value)
  }

  return (
    <div className={['tabs', className].filter(Boolean).join(' ')} role="tablist" aria-label={label}>
      {items.map((item, i) => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="tab"
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            <span>{item.label}</span>
            {item.count !== undefined && <span className="tab-count num">{item.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
