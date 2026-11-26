import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** dialog: centrado (hoja inferior en móvil) · drawer: panel lateral derecho */
  variant?: 'dialog' | 'drawer'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * Modal sobre <dialog> nativo: foco atrapado, Escape y fondo inerte sin librerías.
 * En móvil se presenta como hoja inferior (estilo iOS).
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'dialog',
  size = 'md',
}: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      document.documentElement.classList.add('modal-open')
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  // Si el componente se desmonta abierto, libera el bloqueo de scroll.
  useEffect(() => () => document.documentElement.classList.remove('modal-open'), [])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleClose = () => {
      document.documentElement.classList.remove('modal-open')
      onClose()
    }
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  // Desmonta al cerrar para que el estado interno de formularios se reinicie.
  return (
    <dialog
      ref={ref}
      className={`modal modal-${variant} modal-${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onMouseDown={(e) => {
        // Clic en el fondo (el propio <dialog>) cierra.
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      {open && (
        <div className="modal-surface">
          <header className="modal-header">
            <div className="grow">
              <h2 id={titleId}>{title}</h2>
              {description && (
                <p id={descId} className="muted modal-description">
                  {description}
                </p>
              )}
            </div>
            <IconButton icon={X} label="Cerrar" onClick={() => ref.current?.close()} />
          </header>
          <div className="modal-body">{children}</div>
          {footer && <footer className="modal-footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  )
}
