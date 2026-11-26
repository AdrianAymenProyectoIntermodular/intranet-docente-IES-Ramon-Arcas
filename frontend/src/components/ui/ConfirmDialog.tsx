import { useState, type ReactNode } from 'react'
import { Button } from './Button'
import { Modal } from './Modal'

type Props = {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  onConfirm: () => Promise<void> | void
  onClose: () => void
}

/** Confirmación para acciones importantes; mantiene el botón ocupado mientras se ejecuta. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onClose,
}: Props) {
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      // El llamador muestra el error (toast); el diálogo sigue abierto para reintentar.
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant={tone} onClick={() => void run()} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="muted">{children}</div>
    </Modal>
  )
}
