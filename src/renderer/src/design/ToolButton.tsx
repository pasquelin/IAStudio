import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/helpers/cn'
import type { TooltipFactory } from '@/helpers/tooltip'
import { BUTTON_BASE } from './styles'
import { UiIcon } from './UiIcon'

/**
 * What each host costs the button, on one line per host.
 *
 * A table rather than two conditions, because the two do not cut the same way: the BOX separates
 * `row` from the rest, the GLYPH separates `bar` from the rest. Written as a pair of ternaries,
 * a fourth host meant guessing which side of two different partitions it fell on.
 *
 * `row` is the only one that shrinks the box, and the reason is measured: at a bar's gauge, an
 * eye and two padlocks took 68px off the end of a 28px layer line — more than a fifth of a side
 * panel, on the very rows whose name is what one reads.
 */
const HOSTS = {
  bar: { box: 'size-(--sc-control)', glyph: 16 },
  header: { box: 'size-(--sc-control)', glyph: 14 },
  row: { box: 'size-(--sc-control-inline)', glyph: 14 },
}

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
  /** Which host the button sits on — see `HOSTS` for what each one costs. */
  variant?: keyof typeof HOSTS
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
        HOSTS[variant].box,
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
      {icon !== undefined && <UiIcon path={icon} size={iconSize ?? HOSTS[variant].glyph} />}
      {children}
    </button>
  )
}
