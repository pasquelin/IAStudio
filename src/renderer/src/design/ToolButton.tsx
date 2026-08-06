import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from './cn'
import { withShortcut, type TooltipFactory } from './tooltip'
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
  /** Tooltip factory of the host bar. When absent, the `aria-label` is still set. */
  tooltip?: TooltipFactory
  shortcut?: string | false
  /** Tool currently in use: neutral background. */
  active?: boolean
  /** Tool in use AND whose zone has focus: accented background. */
  accented?: boolean
  /** `header` is the smaller gauge used in panel title bars. */
  variant?: 'bar' | 'header'
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
  const naming = tooltip
    ? tooltip(label, shortcut)
    : { 'aria-label': withShortcut(label, shortcut) }

  return (
    <button
      type="button"
      ref={ref}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-(--radius-sc-md)',
        'text-muted size-(--sc-control) border-none bg-transparent outline-none',
        'hover:bg-elevated hover:text-text transition-colors',
        'focus-visible:ring-accent focus-visible:ring-1',
        'disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-elevated text-text',
        accented && 'bg-accent hover:bg-accent text-white',
        className,
      )}
      {...naming}
      {...rest}
    >
      {icon !== undefined && (
        <UiIcon path={icon} size={iconSize ?? (variant === 'header' ? 14 : 16)} />
      )}
      {children}
    </button>
  )
}
