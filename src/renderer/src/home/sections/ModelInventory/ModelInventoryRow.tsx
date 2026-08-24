import { rowSkin, ROW_INK, ROW_QUIET } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { HINT_TOP } from '@/helpers/tooltip'

export type ModelInventoryRowProps = {
  /** The employment, or the family holding several of them. */
  label: string
  /** What answers for it — a model, a cloud, or a tally of how many of the family are served. */
  standing: string
  hint: string
  onClick: () => void
}

/** One employment line of the band, and the way into the screen that chooses what serves it. */
export function ModelInventoryRow({ label, standing, hint, onClick }: ModelInventoryRowProps) {
  return (
    <button
      type="button"
      {...HINT_TOP(hint)}
      onClick={onClick}
      className={cn(
        rowSkin(false),
        'flex w-full cursor-pointer items-center gap-3 border-none bg-transparent px-2 py-1.5 text-left',
      )}
    >
      <span className={cn(ROW_INK, 'min-w-0 flex-1 truncate text-xs')}>{label}</span>
      <span className={cn(ROW_QUIET, 'text-tiny shrink-0')}>{standing}</span>
    </button>
  )
}
