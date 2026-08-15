import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/helpers/cn'
import { HINT_BOTTOM, type HintFactory } from '@/helpers/tooltip'
import { windowControl } from './window-styles'

export type WindowChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'aria-pressed' | 'children' | 'title' | 'type'
> & {
  /** The choice this chip stands for, as the reader sees it. */
  label: string
  /**
   * What picking it does. The label is already on screen, so the sentence explains instead of
   * repeating — and no `aria-label` is set over it (WCAG SC 2.5.3).
   */
  hint: string
  selected: boolean
  /** Where the hint opens. The host knows which edge it sits against; the chip never does. */
  tip?: HintFactory
}

/**
 * `Chip`'s counterpart for the windows that are NOT docks — the usage period, first of them.
 *
 * Same role, deliberately not the same component: this one is painted by `windowControl` and
 * speaks DaisyUI's tokens, `Chip` speaks the studio's. Folding them into one and choosing by a
 * prop would make every caller answer a question its own address already answers.
 */
export function WindowChip({
  label,
  hint,
  selected,
  tip = HINT_BOTTOM,
  className,
  ...rest
}: WindowChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...tip(hint)}
      className={cn(windowControl(selected), 'justify-center px-2.5 font-normal', className)}
      {...rest}
    >
      {label}
    </button>
  )
}
