import { mdiChevronDown } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { fieldHandle } from '../scHandle'
import type { TooltipFactory } from '@/helpers/tooltip'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { Flyout } from '../Flyout'
import { ToolButton } from '../ToolButton'
import { UiIcon } from '../UiIcon'

export type ToggleMenuProps = {
  /** `@mdi/js` path. Worn by the toggle half, or by the value half when there is no toggle. */
  icon: string
  /** Already translated. Names the toggle half — what pressing the icon turns on. */
  label: string
  /**
   * Already translated, and in TWO halves: what the toggle does, then what the menu sets. A
   * reader who only hears the first takes the menu for a second way to press the same button.
   */
  description: string
  tooltip: TooltipFactory
  /** Absent for the one control that has no toggle half — the camera speed sets, never arms. */
  pressed?: boolean
  onToggle?: () => void
  /** Already translated. What the menu half reads while it is closed. */
  value: string
  /**
   * The longest reading this control will ever show, already translated. Its place is held open
   * whatever is on: without it a value changing width — « 4 m/s » to « 10 m/s » — resizes the
   * button, and the whole bar shuffles under a dragged slider.
   */
  widest?: string
  /**
   * Already translated. What the menu half IS — « Grid step », « Camera speed ». The accessible
   * name is composed from it and `value`, here rather than at each caller: a name that dropped
   * the figure on screen would leave a speech-input user reaching nothing (WCAG 2.5.3), and that
   * is this component's rule to keep, not something five callers should each remember.
   */
  valueName: string
  /** How many rows the menu holds. One or none leaves the value half inert. */
  rowCount: number
  rows: (close: () => void) => ReactNode
  /**
   * The handle a script drives this control by. Two are derived from it — `.toggle` and `.menu`
   * — because the two zones do different things and a script has to say which one it means.
   */
  scId?: string
}

/**
 * Two zones side by side: an icon that toggles, and a value that opens a menu. What choosing a
 * value does is the CALLER's to decide — the snap bar arms the toggle with it, so that reaching
 * for a step does not cost a second click.
 *
 * No border of its own: the bar it sits on already draws one, and a control that framed itself
 * inside it gave the studio two rules of bordering where it has one.
 *
 * It opens the way every other menu of the studio opens — on hover, and on `Alt+ArrowDown` — and
 * its click BASCULES rather than only opening: a menu asked for by hand is one a second click
 * must be able to put away.
 */
export function ToggleMenu({
  icon,
  label,
  description,
  tooltip,
  pressed,
  onToggle,
  value,
  widest,
  valueName,
  rowCount,
  rows,
  scId,
}: ToggleMenuProps) {
  const { t } = useTranslation()
  const flyout = useHoverFlyout(rowCount)

  return (
    // `wrapProps`, exactly as `MenuButton` spreads them: the tool column opens its own menus on
    // hover, and a second bar over the same viewport opening only on click was two manners for
    // one gesture. The click stays, as a TOGGLE — a menu one opened by hand closes the same way.
    <div {...flyout.wrapProps} className="flex items-center gap-0.5">
      {onToggle && (
        <ToolButton
          icon={icon}
          label={label}
          description={description}
          tooltip={tooltip}
          variant="bar"
          active={pressed}
          data-sc={scId && fieldHandle(`${scId}.toggle`)}
          // An armed snap is something one ACTIONS, which `CLAUDE.md` gives the full accent —
          // and `active` alone paints it `elevated`, the colour the hover already uses. The bar
          // then said the same thing about the control under the pointer and the one armed.
          // `ToolbarTool` reaches for the same pair, for the same reason.
          accented={pressed}
          onClick={onToggle}
        />
      )}

      <ToolButton
        {...flyout.triggerProps}
        icon={onToggle ? undefined : icon}
        label={t('a11y.namedValue', { value, name: valueName })}
        description={description}
        tooltip={tooltip}
        variant="bar"
        // The rows cover the button and its own tip with them, which then reads as a sentence
        // cut in half. The accessible name stays — it is not the tooltip's to lose.
        tipHidden={flyout.showing}
        data-sc={scId && fieldHandle(`${scId}.menu`)}
        disabled={!flyout.hasFlyout}
        className={cn('text-muted w-auto gap-0.5 px-1 tabular-nums', flyout.showing && 'text-text')}
        onClick={() => (flyout.showing ? flyout.close() : flyout.open())}
      >
        {/* The widest reading, laid under the current one in the same grid cell: it reserves
            exactly the room the text needs, at any font scale, without a pixel written here. */}
        <span className="text-tiny grid">
          <span aria-hidden className="invisible col-start-1 row-start-1">
            {widest ?? value}
          </span>
          <span className="col-start-1 row-start-1">{value}</span>
        </span>
        <UiIcon path={mdiChevronDown} size={12} />
      </ToolButton>

      {/* No `role="menu"` on the flyout: what it holds is a `radiogroup`, a form or a slider, and
          promising rows a reader could step through sends it looking for what is not there. */}
      {flyout.showing && (
        <Flyout anchor={flyout.anchor} placement="below-left" {...flyout.flyoutProps}>
          {rows(flyout.close)}
        </Flyout>
      )}
    </div>
  )
}
