import type { ReactNode } from 'react'
import type { TooltipFactory } from '@/helpers/tooltip'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { Flyout } from './Flyout'
import { ToolButton, type ToolButtonProps } from './ToolButton'

export type MenuButtonProps = Pick<
  ToolButtonProps,
  | 'icon'
  | 'label'
  | 'description'
  | 'shortcut'
  | 'active'
  | 'accented'
  | 'acts'
  | 'disabled'
  | 'variant'
  // Drawn beside the icon, for a menu whose CHOICE has to stay readable while it is closed — a
  // filter says what it is filtering on, or collapsing its chips only hides them.
  | 'children'
  /*
   * Needed BY `children` and not separately: `ToolButton` is square by gauge (`size-(--sc-control)`,
   * and `styles.ts` states the rule), so a label handed to it without `w-auto` is clipped to a
   * character or two. jsdom lays nothing out, so no test can see that — `ZoomBar` is the other
   * label-bearing caller and undoes the square the same way.
   */
  | 'className'
> & {
  tooltip: TooltipFactory
  /** How many rows the menu holds. One or none makes the button act directly. */
  rowCount: number
  /** Drawn inside the flyout. `close` lets a row dismiss the menu it was chosen from. */
  rows: (close: () => void) => ReactNode
  /** Fired on click, before the menu opens. Absent for a button that only opens its menu. */
  onClick?: () => void
  /**
   * What the click does when there is NO menu to open — `useHoverFlyout` treats a single row as
   * none. `TitleBarSelect` published this first; without it every caller re-derived the threshold
   * from its own arithmetic, in units the hook never uses.
   */
  onAct?: () => void
  /** Fired each time the menu shows, however it was opened. For rows read from somewhere that
   * changes without the app being told. Not `onOpen`, which `Collection` spends on opening an
   * item — a user's intent, where this one is a lifecycle. */
  onShow?: () => void
  /**
   * Whether the click opens the menu. False for a group whose click arms a mode — there, the
   * menu only offers to switch, and opening it on every click would fight the armed tool.
   */
  opensOnClick: boolean
  /**
   * Whether the rows really are menu items. False for the one caller whose flyout holds sliders:
   * `role="menu"` over anything but menu items sends a screen reader looking for rows to step
   * through, and finding none.
   */
  menu?: boolean
}

/**
 * A button whose menu opens on hover — on click when `opensOnClick`, and on `Alt+ArrowDown`
 * always, since hovering is not a keyboard gesture and a group whose click arms a mode has no
 * other way in. Written once for the toolbar's mode groups and the panel title bars: the
 * anchoring, the grace period and the close-on-select are the hard half, and they were drifting
 * apart.
 */
export function MenuButton({
  tooltip,
  rowCount,
  rows,
  onClick,
  onAct,
  onShow,
  opensOnClick,
  menu = true,
  ...button
}: MenuButtonProps) {
  const flyout = useHoverFlyout(rowCount, onShow)

  return (
    <div {...flyout.wrapProps} className="contents">
      <ToolButton
        {...button}
        // The anchor, the ARIA pair and the APG chord — `Alt+ArrowDown`, the only way into a mode
        // group, where the click arms the tool rather than opening. All three from the hook, so
        // the whole-line trigger of `PictureField` cannot get a different set of manners.
        {...flyout.triggerProps}
        // …except the promise itself, which is the one thing that is not the hook's to make: this
        // button also serves a flyout of sliders, and `role="menu"` over anything but menu items
        // sends a screen reader looking for rows to step through.
        aria-haspopup={menu ? flyout.triggerProps['aria-haspopup'] : undefined}
        tooltip={tooltip}
        // The flyout opens right beside the button and covers its own tip, which then reads as a
        // sentence cut in half. The accessible name stays — it is not the tooltip's to lose.
        tipHidden={flyout.showing}
        onClick={() => {
          onClick?.()
          if (!flyout.hasFlyout) onAct?.()
          else if (opensOnClick) flyout.open()
        }}
      />

      {flyout.showing && (
        <Flyout anchor={flyout.anchor} role={menu ? 'menu' : undefined} {...flyout.flyoutProps}>
          {rows(flyout.close)}
        </Flyout>
      )}
    </div>
  )
}
