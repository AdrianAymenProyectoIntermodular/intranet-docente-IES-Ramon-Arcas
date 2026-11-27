import {
  cloneElement,
  isValidElement,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

type FieldProps = {
  label: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  /** Un único control (Input, Select, Textarea): recibe id y aria-* automáticamente. */
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
  className?: string
}

/** Etiqueta + control + ayuda + error, con asociación accesible. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })
    : children
  return (
    <div className={['field', error && 'field-invalid', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && (
          <span className="field-required" aria-hidden>
            {' '}
            *
          </span>
        )}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={['input', className].filter(Boolean).join(' ')} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={['input', 'select', className].filter(Boolean).join(' ')} {...props}>
      {children}
    </select>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={['input', 'textarea', className].filter(Boolean).join(' ')} {...props} />
}

export function Checkbox({
  label,
  description,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className="check">
      <input type="checkbox" {...props} />
      <span className="check-box" aria-hidden />
      <span className="check-text">
        <span>{label}</span>
        {description && <span className="subtle">{description}</span>}
      </span>
    </label>
  )
}
