import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/helpers/cn'
import type { TooltipFactory } from '@/helpers/tooltip'
import { BUTTON_BASE } from './styles'
import { UiIcon } from './UiIcon'

export type ToolButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children' | 'title'
> & {
  /**
   * `@mdi/js` icon path. When absent the button renders only its `children` — for the one
   * whose preview IS the value it sets, which no glyph can express.
   */
  icon?: string
  /** Accessible name and tooltip content. */
  label: string
  /** Shown in the tooltip in place of the label — for a control whose name is already on screen. */
  description?: string
  /**
   * Tooltip factory of the host bar — required: an icon-only button whose action is never
   * spelled out is a button one has to press to find out what it does.
   */
  tooltip: TooltipFactory
  shortcut?: string | false
  /** Tool currently in use: neutral background. */
  active?: boolean
  /** Tool in use AND whose zone has focus: accented background. */
  accented?: boolean
  /**
   * Which host the button sits on. `bar` is a toolbar, `header` a panel's title bar — the same
   * box, a smaller glyph. `row` is a control INSIDE a list row, the eye and the padlock, and it
   * is the only one that shrinks the box: at a bar's gauge, two of them took 68px off the end of
   * a 28px layer line, on the very rows whose name is what one reads.
   */
  variant?: 'bar' | 'header' | 'row'
  iconSize?: number
  children?: ReactNode
  /** The `<button>` itself, so a bar can publish its active button as an anchor. */
  ref?: Ref<HTMLButtonElement>
}

/**
 * A toolbar button: icon, active and accented states, accessible name carrying the shortcut.
 * The single source of the bars' visual language — without it every site re-copied the active
 * class, the tooltip attributes and the icon size, and a missing `aria-label` went unnoticed.
 */
export function ToolButton({
  icon,
  label,
  description,
  tooltip,
  shortcut,
  active,
  accented,
  variant = 'bar',
  className,
  iconSize,
  children,
  ref,
  ...rest
}: ToolButtonProps) {
  const naming = tooltip(label, shortcut, description)

  return (
    <button
      type="button"
      ref={ref}
      aria-pressed={active}
      className={cn(
        BUTTON_BASE,
        'text-muted shrink-0 bg-transparent',
        variant === 'row' ? 'size-(--sc-control-inline)' : 'size-(--sc-control)',
        'hover:bg-elevated hover:text-text',
        // Inside a row filled with the accent — the open project's menu button is the case — the
        // rest ink reads 1.50:1 on that blue, and `elevated` under the pointer is grey on it. Both
        // are read off `rowSkin`'s group, as `ROW_INK` and `ROW_QUIET` are, so no list passes state
        // down; outside such a row the attribute never appears and neither variant fires.
        'group-data-accented/row:text-accent-content',
        'group-data-accented/row:hover:bg-accent-hover',
        active && 'bg-elevated text-text',
        accented && 'bg-accent hover:bg-accent text-accent-content',
        className,
      )}
      {...naming}
      {...rest}
    >
      {icon !== undefined && (
        <UiIcon path={icon} size={iconSize ?? (variant === 'bar' ? 16 : 14)} />
      )}
      {children}
    </button>
  )
}
