import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

export type FormFieldProps = {
  label: string
  /**
   * The control this names — a `<button>` is labelable too, so a picker takes one. Without an id
   * the name is plain text: a `<label>` bound to nothing is announced as a control of its own.
   */
  htmlFor?: string
  required?: boolean
  /** Worn by the field, not by the control: what a caller sizes or spans is the whole thing. */
  className?: string
  /** The control, and whatever follows it — help, an error, a hint of its own. */
  children: ReactNode
}

/**
 * A form field: its name ABOVE it, the control at full width — as against the inspector's
 * property LINE, whose name sits in a column beside it. Mixing the two reads as two forms.
 */
export function FormField({ label, htmlFor, required, className, children }: FormFieldProps) {
  const name = (
    <>
      {label}
      {required && <span aria-hidden> *</span>}
    </>
  )

  return (
    <div className={cn('flex flex-col gap-2 text-xs', className)}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-muted">
          {name}
        </label>
      ) : (
        <span className="text-muted">{name}</span>
      )}
      {children}
    </div>
  )
}
