import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/helpers/cn'
import { HINT_LEFT, type HintFactory } from '@/helpers/tooltip'
import { chipSkin } from './styles'

export type ChipProps = Omit<
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
 * One choice of an exclusive row — a preview shape, a view mode, a tiling factor. Its state is
 * `aria-pressed`, which is what a row of buttons outside a `tablist` answers to; a tab of a real
 * `tablist` is a different contract and stays where its list is.
 */
export function Chip({ label, hint, selected, tip = HINT_LEFT, className, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      {...tip(hint)}
      className={cn(chipSkin(selected), className)}
      {...rest}
    >
      {label}
    </button>
  )
}
