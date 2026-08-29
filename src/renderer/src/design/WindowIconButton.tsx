import { UiIcon } from './UiIcon'
import { cn } from '@/helpers/cn'

/**
 * 🛑 Not exported, and that is the point: a caller wearing this skin on a bare `<button>` would
 * have the glyph without the tooltip this component makes compulsory, and the loose-button guard
 * would not see it — its regex only catches literals holding the `btn` token.
 */
const ICON_ACTION = 'btn btn-ghost btn-xs btn-square'

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
   * What the gesture DOES — the attributes a `TooltipFactory` returns, placement chosen by the
   * HOST (`TIP_LEFT`, `HINT_LEFT`, `tipFor(…)`). Required, like `ToolButton`'s.
   */
  tooltip: Record<string, string>
  disabled?: boolean
  /** Kept in place rather than unmounted: a row that reflows under the pointer is unclickable. */
  faded?: boolean
  className?: string
  onClick: () => void
}

/**
 * A glyph alone at the end of a row of these windows — the way Git, MCP and Storage end theirs.
 *
 * 🛑 A component rather than a class string, and that is what makes the tooltip unforgettable:
 * a glyph without one names nothing to a screen reader or to a script.
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
      className={cn(ICON_ACTION, className)}
      disabled={disabled}
      onClick={onClick}
    >
      <UiIcon path={path} size={WINDOW_ICON_SIZE} className={faded ? 'opacity-0' : ''} />
    </button>
  )
}
