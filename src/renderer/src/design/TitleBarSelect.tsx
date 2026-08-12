import { mdiChevronDown } from '@mdi/js'
import { useState, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { Flyout } from './Flyout'
import { FOCUS_RING, TITLE_BAR_GHOST } from './styles'
import { UiIcon } from './UiIcon'

export type TitleBarSelectProps = {
  /** Drawn before the label — a folder glyph, a connection dot. Decorative: `name` carries it. */
  leading: ReactNode
  /** What the eye reads: the project that is open, the account in use. Truncated, never wrapped. */
  label: string
  /** The accessible name. `MenuRow` handles its own; this is the closed button's. */
  name: string
  /** The sentence the tooltip explains it with, since the label alone says nothing about acting. */
  hint: string
  /** How many rows the menu holds. One or none makes the button act instead of opening. */
  rowCount: number
  /** Drawn inside the flyout. `close` lets a row dismiss the menu it was chosen from. */
  rows: (close: () => void) => ReactNode
  /**
   * What the button does when there is no menu to open — the one thing left to do anyway.
   * Absent for a caller whose `rowCount` can never fall to one: the branch is then unreachable,
   * and a handler nothing can call is a line no test can cover.
   */
  onAct?: () => void
  /** The label's ceiling. It is per caller: a project name is longer than an account's. */
  width: string
}

/**
 * The right end of the title bar: what the studio is pointed at, and the menu that repoints it.
 *
 * Written once for the two that live there. They were the same forty lines twice — the anchoring,
 * the grace period, the `aria-haspopup`/`aria-expanded` pair and the `truncate` under a ceiling —
 * which is the drift `MenuButton` was written to stop for the panel headers. This is that
 * component's other host: `ToolButton` is square by gauge and wears `BUTTON_BASE`, and this end
 * of the bar wears `TITLE_BAR_GHOST` over a draggable chrome.
 */
export function TitleBarSelect({
  leading,
  label,
  name,
  hint,
  rowCount,
  rows,
  onAct,
  width,
}: TitleBarSelectProps) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const flyout = useHoverFlyout(rowCount)

  return (
    <div {...flyout.wrapProps} className="contents">
      <button
        ref={setAnchor}
        type="button"
        {...TIP_BOTTOM(name, false, hint)}
        // Only when there is one: with a single row the button acts outright, and announcing a
        // menu it will never show sends a screen reader looking for it.
        aria-haspopup={flyout.hasFlyout ? 'menu' : undefined}
        aria-expanded={flyout.hasFlyout ? flyout.showing : undefined}
        onClick={flyout.hasFlyout ? flyout.open : onAct}
        // The ring is the caller's job on `TITLE_BAR_GHOST`, and its own doc says so: without it
        // the platform draws an outline in a blue that belongs to no theme.
        className={cn(
          TITLE_BAR_GHOST,
          FOCUS_RING,
          'text-tiny h-(--sc-control) gap-1.5 px-2',
          width,
        )}
      >
        {leading}
        <span className="truncate">{label}</span>
        <UiIcon path={mdiChevronDown} size={12} />
      </button>

      {flyout.showing && (
        <Flyout anchor={anchor} placement="below" role="menu" {...flyout.flyoutProps}>
          {rows(flyout.close)}
        </Flyout>
      )}
    </div>
  )
}
