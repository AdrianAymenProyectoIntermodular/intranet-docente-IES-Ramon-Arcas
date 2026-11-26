import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { IconButton } from './Button'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Si se indica, la columna es ordenable por este valor. */
  sortValue?: (row: T) => string | number
  align?: 'start' | 'end'
  /** Oculta la columna en pantallas estrechas. */
  hideOnMobile?: boolean
  width?: string
}

type Sort = { key: string; dir: 'asc' | 'desc' } | null

/** Tabla con ordenación por columnas; en móvil cada fila se presenta como tarjeta. */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  onRowClick,
  initialSort = null,
  empty,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  caption: string
  onRowClick?: (row: T) => void
  initialSort?: Sort
  empty?: ReactNode
}) {
  const [sort, setSort] = useState<Sort>(initialSort)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const get = col.sortValue
    return [...rows].sort((a, b) => {
      const va = get(a)
      const vb = get(b)
      const cmp =
        typeof va === 'number' && typeof vb === 'number'
          ? va - vb
          : String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' })
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, columns, sort])

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  if (rows.length === 0 && empty) return <>{empty}</>

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key
              const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={[c.align === 'end' && 'align-end', c.hideOnMobile && 'hide-mobile']
                    .filter(Boolean)
                    .join(' ')}
                  style={c.width ? { width: c.width } : undefined}
                >
                  {c.sortValue ? (
                    <button type="button" className="th-sort" onClick={() => toggle(c.key)}>
                      {c.header}
                      {active ? (
                        sort.dir === 'asc' ? (
                          <ArrowUp size={14} aria-hidden />
                        ) : (
                          <ArrowDown size={14} aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown size={14} aria-hidden className="th-sort-idle" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              className={onRowClick ? 'row-clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row)
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  data-label={c.header}
                  className={[c.align === 'end' && 'align-end', c.hideOnMobile && 'hide-mobile']
                    .filter(Boolean)
                    .join(' ')}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({
  page,
  limit,
  total,
  onChange,
}: {
  page: number
  limit: number
  total: number
  onChange: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / limit))
  if (total === 0) return null
  const from = (page - 1) * limit + 1
  const to = Math.min(total, page * limit)
  return (
    <nav className="pagination" aria-label="Paginación">
      <span className="subtle num">
        {from}–{to} de {total}
      </span>
      <div className="row">
        <IconButton
          icon={ChevronLeft}
          label="Página anterior"
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        />
        <span className="num pagination-page" aria-current="page">
          {page} / {pages}
        </span>
        <IconButton
          icon={ChevronRight}
          label="Página siguiente"
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        />
      </div>
    </nav>
  )
}
