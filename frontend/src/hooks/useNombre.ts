import { useUser } from '../auth/auth-context'

/**
 * Texto para mostrar una persona a partir de su id y del nombre que ya resuelve la API.
 * "Tú" para la cuenta actual y "Sin asignar" si no hay nadie.
 */
export function useNombre(): (id: string | null | undefined, nombre: string | null | undefined) => string {
  const user = useUser()
  return (id, nombre) => {
    if (!id) return 'Sin asignar'
    if (id === user.id) return 'Tú'
    return nombre ?? 'Cuenta no disponible'
  }
}
