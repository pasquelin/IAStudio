import { rowSkin, ROW_INK, ROW_QUIET } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_TOP } from '@/helpers/tooltip'
import { ModelInventoryGauge } from './ModelInventoryGauge'

export type ModelInventoryRowProps = {
  /** The employment, or the family holding several of them. */
  label: string
  served: number
  total: number
  /** What answers for it — a model, a cloud, or a tally of how many of the family are served. */
  standing: string
  hint: string
  onClick: () => void
}

/**
 * One employment line, and the way into the screen that chooses what serves it.
 *
 */
export function ModelInventoryRow({
  label,
  served,
  total,
  standing,
  hint,
  onClick,
}: ModelInventoryRowProps) {
  return (
    <button
      type="button"
      {...HINT_TOP(hint)}
      onClick={onClick}
      className={cn(
        rowSkin(false),
        'flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-2 py-1 text-left',
      )}
    >
      <span className={cn(ROW_INK, 'w-24 shrink-0 truncate text-xs')}>{label}</span>

      <ModelInventoryGauge served={served} total={total} />

      <span className={cn(ROW_QUIET, 'text-tiny ml-auto shrink-0 truncate')}>{standing}</span>
    </button>
  )
}
