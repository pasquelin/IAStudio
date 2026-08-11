import { useState, type ReactNode } from 'react'
import type { TooltipFactory } from '@/helpers/tooltip'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { Flyout } from './Flyout'
import { ToolButton, type ToolButtonProps } from './ToolButton'

export type MenuButtonProps = Pick<
  ToolButtonProps,
  'icon' | 'label' | 'description' | 'shortcut' | 'active' | 'disabled' | 'variant'
> & {
  tooltip: TooltipFactory
  /** How many rows the menu holds. One or none makes the button act directly. */
  rowCount: number
  /** Drawn inside the flyout. `close` lets a row dismiss the menu it was chosen from. */
  rows: (close: () => void) => ReactNode
  /** Fired on click, before the menu opens. Absent for a button that only opens its menu. */
  onClick?: () => void
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
 * A button whose menu opens on hover — and on click too, since hovering is not a keyboard
 * gesture. Written once for the toolbar's mode groups and the panel title bars: the anchoring,
 * the grace period and the close-on-select are the hard half, and they were drifting apart.
 */
export function MenuButton({
  tooltip,
  rowCount,
  rows,
  onClick,
  opensOnClick,
  menu = true,
  ...button
}: MenuButtonProps) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const flyout = useHoverFlyout(rowCount)

  return (
    <div {...flyout.wrapProps} className="contents">
      <ToolButton
        {...button}
        ref={setAnchor}
        tooltip={tooltip}
        onClick={() => {
          onClick?.()
          if (opensOnClick) flyout.open()
        }}
      />

      {flyout.showing && (
        <Flyout
          anchor={anchor}
          role={menu ? 'menu' : undefined}
          // Only once it was asked for, and only over real rows: hovering into a menu must not
          // take the focus, and the arrows find nothing in a flyout that holds sliders.
          onKeyClose={menu && flyout.asked ? flyout.close : undefined}
          onDismiss={flyout.asked ? flyout.close : undefined}
          {...flyout.flyoutProps}
        >
          {rows(flyout.close)}
        </Flyout>
      )}
    </div>
  )
}
