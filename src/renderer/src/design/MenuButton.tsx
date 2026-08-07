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
        <Flyout anchor={anchor} {...flyout.flyoutProps}>
          {rows(flyout.close)}
        </Flyout>
      )}
    </div>
  )
}
