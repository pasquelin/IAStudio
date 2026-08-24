import { UiIcon } from '@/design/UiIcon'
import { rowSkin, TILE_QUIET } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_TOP } from '@/helpers/tooltip'

export type ModelInventoryCardProps = {
  icon: string
  title: string
  /** The one figure the eye lands on — a count, or the word standing in for none. */
  headline: string
  /** What the figure is made of, one short clause per line. Empty ones are dropped by the caller. */
  lines: readonly string[]
  /** What clicking does. The card carries the whole gesture: half a tile that acts reads worse. */
  hint: string
  onClick: () => void
}

/**
 * One source the studio can draw a model from — this machine, Ollama, the clouds.
 *
 * The whole tile is the button, as the tools band does: a card with an action tucked in a corner
 * gives the pointer two targets for one idea, and the smaller one is the one that acts.
 */
export function ModelInventoryCard({
  icon,
  title,
  headline,
  lines,
  hint,
  onClick,
}: ModelInventoryCardProps) {
  return (
    <button
      type="button"
      {...HINT_TOP(hint)}
      onClick={onClick}
      className={cn(
        rowSkin(false, { surface: 'tile' }),
        'flex cursor-pointer flex-col items-start gap-1.5 text-left',
        'rounded-(--radius-sc-md) border-none bg-transparent p-3 transition-colors',
      )}
    >
      <span className="flex items-center gap-2">
        <UiIcon path={icon} size={16} className="text-muted shrink-0" />
        <span className="text-muted text-mini font-semibold tracking-wider uppercase">{title}</span>
      </span>

      <span className="text-text text-body leading-tight font-semibold">{headline}</span>

      {lines.map(line => (
        // `TILE_QUIET` and not `ROW_QUIET`: `muted` reads 3.51:1 on `elevated`, the fill this
        // tile takes on hover.
        <span key={line} className={cn(TILE_QUIET, 'text-tiny leading-snug')}>
          {line}
        </span>
      ))}
    </button>
  )
}
