import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { FIELD_NAME } from './styles'

export type FormFieldProps = {
  label: string
  /**
   * The control this names — a `<button>` is labelable too, so a picker takes one. Without an id
   * the name is plain text: a `<label>` bound to nothing is announced as a control of its own.
   *
   * 🛑 NOT for a control that opens something. A `<label>` forwards its click, so the disclosure
   * opened on the forwarded click and closed on the original one, which lands outside the panel
   * — the model picker flickered and never stayed open. Such a button names itself by what it
   * shows, and takes no `htmlFor`.
   */
  htmlFor?: string
  required?: boolean
  /**
   * The control itself, when the field lays it out — which it must whenever the name sits BESIDE
   * it. A caller composing its own row passes everything in `children`, as before.
   */
  control?: ReactNode
  /**
   * Whether the name reads AFTER the control on one line, rather than above it.
   *
   * What a checkbox needs, and nothing else: its box is not a full-width control, so under its
   * own name it read as an orphan square with a caption under it.
   */
  beside?: boolean
  /** Worn by the field, not by the control: what a caller sizes or spans is the whole thing. */
  className?: string
  /** Whatever follows the control — help, an error, a hint of its own. */
  children?: ReactNode
}

/**
 * A form field: its name ABOVE it, the control at full width — as against the inspector's
 * property LINE, whose name sits in a column beside it. Mixing the two reads as two forms.
 */
export function FormField({
  label,
  htmlFor,
  required,
  control,
  beside,
  className,
  children,
}: FormFieldProps) {
  const name = (
    <>
      {label}
      {required && <span aria-hidden> *</span>}
    </>
  )

  const named = htmlFor ? (
    <label htmlFor={htmlFor} className={FIELD_NAME}>
      {name}
    </label>
  ) : (
    <span className={FIELD_NAME}>{name}</span>
  )

  return (
    <div className={cn('flex flex-col gap-1.5 text-xs', className)}>
      {beside && control !== undefined ? (
        <div className="flex items-center gap-2">
          {control}
          {named}
        </div>
      ) : (
        <>
          {named}
          {control}
        </>
      )}
      {children}
    </div>
  )
}
