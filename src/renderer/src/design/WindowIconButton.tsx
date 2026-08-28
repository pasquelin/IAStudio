import { UiIcon } from './UiIcon'
import { WINDOW_ICON_ACTION } from './windowStyles'
import { cn } from '@/helpers/cn'

/** The glyph size these rows carry. Beside the skin rather than at each call, for one reason. */
const WINDOW_ICON_SIZE = 14

export type WindowIconButtonProps = {
  /** An `@mdi/js` path. No inline SVG here, like everywhere else in the studio. */
  path: string
  /**
   * The accessible name, already translated — a glyph has no label of its own, so this IS the
   * name a screen reader and a script both read.
   */
  label: string
  /**
   * What the gesture DOES, shown under the pointer — the attributes a `TooltipFactory` returns.
   * REQUIRED, like `ToolButton`'s: a glyph with no tooltip names nothing to anyone.
   *
   * The placement comes from the host, never from here — `TIP_LEFT`, `HINT_LEFT`, `tipFor(…)`.
   */
  tooltip: Record<string, string>
  disabled?: boolean
  /** Kept in place rather than unmounted: a row that reflows under the pointer is unclickable. */
  faded?: boolean
  className?: string
  onClick: () => void
}

/**
 * A glyph alone at the end of a row of these windows — the way Git, MCP and Storage already end
 * theirs, and now the way a memory does.
 *
 * 🛑 The skin was spelt at one site and copied nowhere, which is what let a second family of row
 * actions grow up in `btn-xs` TEXT instead: four labels took half the width and the summary they
 * act on was truncated to nothing. A component rather than a class string is what makes the
 * tooltip unforgettable — a glyph without one names nothing.
 */
export function WindowIconButton({
  path,
  label,
  tooltip,
  disabled = false,
  faded = false,
  className,
  onClick,
}: WindowIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      {...tooltip}
      className={cn(WINDOW_ICON_ACTION, className)}
      disabled={disabled}
      onClick={onClick}
    >
      <UiIcon path={path} size={WINDOW_ICON_SIZE} className={faded ? 'opacity-0' : ''} />
    </button>
  )
}
