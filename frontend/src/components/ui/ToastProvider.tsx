import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastApi, type ToastTone } from './toast-context'

type Toast = { id: number; message: string; tone: ToastTone }

const ICON = { ok: CircleCheck, error: CircleAlert, info: Info }
const DURACION = { ok: 3800, info: 4200, error: 6500 }

/** Notificaciones efímeras de resultado (región aria-live para lectores de pantalla). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++
      setToasts((t) => [...t.slice(-2), { id, message, tone }])
      window.setTimeout(() => dismiss(id), DURACION[tone])
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({ show, ok: (m) => show(m, 'ok'), error: (m) => show(m, 'error') }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => {
          const Icon = ICON[t.tone]
          return (
            <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
              <Icon size={18} aria-hidden />
              <span className="grow">{t.message}</span>
              <button type="button" className="toast-close" aria-label="Descartar" onClick={() => dismiss(t.id)}>
                <X size={15} aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
