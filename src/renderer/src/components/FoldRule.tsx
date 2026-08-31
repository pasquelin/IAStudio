import { HINT_TOP } from '@/helpers/tooltip'
import { sectionHandle } from './scHandle'

export type FoldRuleProps = {
  open: boolean
  onToggle: () => void
  /** What the rule reads when it will open, and when it will close. Already translated. */
  moreLabel: string
  fewerLabel: string
  moreHint: string
  fewerHint: string
  /** The handle a script folds this by. Never a translated word — see `pilotable.test.ts`. */
  scId?: string
}

/**
 * A rule that doubles as the control that opens what it separates.
 *
 * The collection bar proved the shape: six menus stacked leave a panel with more filter than
 * collection, and a line with a word in it both divides the two halves and offers the second.
 * A generation form is the same problem — the knobs nobody touches under the ones everybody does.
 */
export function FoldRule({
  open,
  onToggle,
  moreLabel,
  fewerLabel,
  moreHint,
  fewerHint,
  scId,
}: FoldRuleProps) {
  return (
    <button
      type="button"
      aria-expanded={open}
      data-sc={scId && sectionHandle(scId)}
      {...HINT_TOP(open ? fewerHint : moreHint)}
      onClick={onToggle}
      className="group flex cursor-pointer items-center gap-2 py-0.5"
    >
      <span className="border-border flex-1 border-t" />
      <span className="text-muted group-hover:text-text text-mini transition-colors">
        {open ? fewerLabel : moreLabel}
      </span>
      <span className="border-border flex-1 border-t" />
    </button>
  )
}
