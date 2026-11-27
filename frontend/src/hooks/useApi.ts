import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { errorMessage } from '../services/api'

export type ApiState<T> = {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => Promise<void>
  /** Sustituye los datos en local tras una mutación confirmada por el servidor. */
  setData: (updater: T | ((prev: T | null) => T)) => void
}

/**
 * Carga de datos con estados loading/error/reload.
 * `deps` (valores primitivos) decide cuándo volver a pedir, como en useEffect.
 * Ignora respuestas obsoletas si cambian las dependencias antes de terminar.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: readonly unknown[] = []): ApiState<T> {
  const [data, setDataState] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)
  const fetcherRef = useRef(fetcher)

  useLayoutEffect(() => {
    fetcherRef.current = fetcher
  })

  const reload = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      if (id === requestId.current) setDataState(result)
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err))
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  const depsKey = JSON.stringify(deps)
  useEffect(() => {
    void reload()
  }, [reload, depsKey])

  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) =>
      typeof updater === 'function' ? (updater as (p: T | null) => T)(prev) : updater,
    )
  }, [])

  return { data, error, loading, reload, setData }
}
