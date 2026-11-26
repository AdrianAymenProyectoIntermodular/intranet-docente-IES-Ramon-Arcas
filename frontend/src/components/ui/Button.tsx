import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  loading?: boolean
  block?: boolean
  children?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  block = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: Props) {
  const classes = ['btn', `btn-${variant}`, `btn-${size}`, block && 'btn-block', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : Icon ? <Icon size={size === 'sm' ? 15 : 17} aria-hidden /> : null}
      {children && <span>{children}</span>}
    </button>
  )
}

/** Enlace de navegación con aspecto de botón (evita anidar <button> dentro de <a>). */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  className,
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <Link className={['btn', `btn-${variant}`, `btn-${size}`, className].filter(Boolean).join(' ')} {...rest}>
      {Icon && <Icon size={size === 'sm' ? 15 : 17} aria-hidden />}
      <span>{children}</span>
    </Link>
  )
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon
  label: string
  variant?: 'ghost' | 'secondary'
  size?: 'sm' | 'md'
}

/** Botón solo icono: `label` es obligatorio para lectores de pantalla y tooltip. */
export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={['icon-btn', `icon-btn-${variant}`, `icon-btn-${size}`, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon size={size === 'sm' ? 16 : 19} aria-hidden />
    </button>
  )
}
