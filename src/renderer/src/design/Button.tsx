import type { ButtonHTMLAttributes, Ref } from 'react'
import { cn } from '@/helpers/cn'
import { FOCUS_RING } from './styles'

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

/**
 * The labelled action button of the docks, next to `ToolButton` which carries an icon. Sized on
 * `--sc-control`, so it shrinks with the density like every other control.
 */
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
        'inline-flex h-(--sc-control) cursor-pointer items-center justify-center',
        'rounded-(--radius-sc-md) border-none px-3 text-[12px] font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        VARIANT[variant],
        FOCUS_RING,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
