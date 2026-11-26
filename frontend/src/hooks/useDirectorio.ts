import { useEffect, useState } from 'react'
import { useUser } from '../auth/auth-context'
import { puede } from '../lib/permissions'
import { listTodosLosUsuarios } from '../services/usuarios'

/** Caché de sesión del claustro (solo admin puede listarlo). */
let cache: Promise<Map<string, string>> | null = null

export function invalidarDirectorio(): void {
  cache = null
}

/**
 * Traduce IDs de usuario a nombres.
 * - Admin: carga el claustro completo una vez por sesión.
 * - Resto: la API no permite consultar a otros usuarios; se resuelve solo "Tú".
 */
export type Directorio = {
  /** Nombre visible; si no se conoce, un identificador corto. */
  nombre: (id: string | null | undefined) => string
  /** Nombre solo si se conoce de verdad (para no mostrar datos inventados). */
  conocido: (id: string | null | undefined) => string | null
}

export function useDirectorio(): Directorio {
  const user = useUser()
  const esAdmin = puede(user.roles, 'usuarios.gestionar')
  const [mapa, setMapa] = useState<Map<string, string>>(() => new Map())

  useEffect(() => {
    if (!esAdmin) return
    let vivo = true
    if (!cache) {
      cache = listTodosLosUsuarios()
        .then((us) => new Map(us.map((u) => [u.id, u.name])))
        .catch(() => {
          cache = null
          return new Map<string, string>()
        })
    }
    void cache.then((m) => {
      if (vivo) setMapa(m)
    })
    return () => {
      vivo = false
    }
  }, [esAdmin])

  const conocido = (id: string | null | undefined) => {
    if (!id) return null
    if (id === user.id) return 'Tú'
    return mapa.get(id) ?? null
  }
  return {
    conocido,
    nombre: (id) => (id ? (conocido(id) ?? `Docente …${id.slice(-4)}`) : 'Sin asignar'),
  }
}
