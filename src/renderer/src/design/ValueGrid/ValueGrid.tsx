import { cn } from '@/helpers/cn'
import { fieldHandle } from '../scHandle'
import { BUTTON_BASE } from '../styles'

export type ValueGridOption = {
  value: number
  /** Already formatted and translated: the grid prints what it is handed and looks nothing up. */
  label: string
}

export type ValueGridProps = {
  options: readonly ValueGridOption[]
  chosen: number
  /** How wide the choice spreads. A list of figures grows sideways, never downwards. */
  columns: 2 | 3
  /** Names the group. Already translated — a grid of bare figures says nothing on its own. */
  label: string
  onChoose: (value: number) => void
  /** The handle a script drives this grid by. Never a translated word — see `pilotable.test.ts`. */
  scId?: string
}

/**
 * A choice among figures, laid out in columns.
 *
 * A menu of rows was the first shape and it was the wrong one: nine steps became a column tall
 * enough to cover the viewport it is about to change, and the choice was said by a tick two
 * hundred pixels from the figure it belonged to. Here the chosen cell CARRIES the mark —
 * `accent-soft`, which `CLAUDE.md` spends on exactly this: a content that is designated, never
 * a control one actions.
 *
 * Radios rather than menu items: this is one value out of several, which is what a `radiogroup`
 * means — and it frees the flyout from promising a `menu` it no longer holds.
 */
export function ValueGrid({ options, chosen, columns, label, onChoose, scId }: ValueGridProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-0.5', columns === 2 ? 'grid-cols-2' : 'grid-cols-3')}
    >
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === chosen}
          // One handle per FIGURE: a script says which value it wants, not "the third cell".
          data-sc={scId && fieldHandle(`${scId}.${option.value}`)}
          className={cn(
            BUTTON_BASE,
            'text-tiny h-(--sc-control) bg-transparent px-2 text-center tabular-nums',
            'text-muted hover:bg-elevated hover:text-text',
            option.value === chosen && 'bg-accent-soft text-text',
          )}
          onClick={() => onChoose(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
