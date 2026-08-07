import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/helpers/cn'
import { BUTTON_BASE } from './styles'

export type ButtonVariant = 'primary' | 'neutral'

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white hover:bg-accent/85',
  neutral: 'bg-surface text-text hover:bg-elevated',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` for the one action a surface exists for; `neutral` for the rest. */
  variant?: ButtonVariant
  ref?: Ref<HTMLButtonElement>
}

/** The labelled action button of the docks, next to `ToolButton` which carries a glyph. */
export function Button({
  variant = 'neutral',
  className,
  type = 'button',
  children,
  ref,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      ref={ref}
      className={cn(
        BUTTON_BASE,
        'h-(--sc-control) px-3 text-[12px] font-medium',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
