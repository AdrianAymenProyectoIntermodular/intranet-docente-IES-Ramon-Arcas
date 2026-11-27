import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import { useUser } from '../../auth/auth-context'
import { tieneAlguno } from '../../lib/permissions'
import type { Role } from '../../services/types'
import { ButtonLink } from '../ui/Button'
import { EmptyState } from '../ui/Feedback'

/**
 * Oculta una vista a quien no tiene el rol. Es solo UX:
 * el backend rechaza igualmente la petición con 403.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useUser()
  if (tieneAlguno(user.roles, roles)) return <>{children}</>
  return (
    <div>
      <EmptyState
        icon={Lock}
        title="No tienes acceso a esta sección"
        action={<ButtonLink to="/">Volver al inicio</ButtonLink>}
      >
        Está reservada a otros perfiles del centro. Si necesitas acceso, pídeselo a la administración.
      </EmptyState>
    </div>
  )
}
