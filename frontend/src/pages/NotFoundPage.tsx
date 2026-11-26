import { Compass } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Feedback'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Página no encontrada" />
      <EmptyState icon={Compass} title="Esta dirección no existe" action={<ButtonLink to="/">Ir al inicio</ButtonLink>}>
        Puede que el enlace esté mal escrito o que la sección se haya movido.
      </EmptyState>
    </>
  )
}
