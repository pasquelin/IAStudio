import { mdiChevronDown } from '@mdi/js'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { Flyout } from './Flyout'
import { TITLE_BAR_TRIGGER } from './styles'
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
  /** Run when the menu appears, for a caller whose rows report something read over the network. */
  onOpen?: () => void
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
  onOpen,
  width,
}: TitleBarSelectProps) {
  const flyout = useHoverFlyout(rowCount, onOpen)

  return (
    <div {...flyout.wrapProps} className="contents">
      <button
        type="button"
        {...TIP_BOTTOM(name, false, hint)}
        // The anchor, the ARIA pair and the `Alt+ArrowDown` chord, all from the hook. This site
        // declared the first two by hand and had never had the third: on the title bar's own
        // selectors, the gesture that opens every other menu of the studio did nothing.
        {...flyout.triggerProps}
        onClick={flyout.hasFlyout ? flyout.open : onAct}
        className={cn(TITLE_BAR_TRIGGER, width)}
      >
        {leading}
        <span className="truncate">{label}</span>
        <UiIcon path={mdiChevronDown} size={12} />
      </button>

      {flyout.showing && (
        <Flyout anchor={flyout.anchor} placement="below" role="menu" {...flyout.flyoutProps}>
          {rows(flyout.close)}
        </Flyout>
      )}
    </div>
  )
}
