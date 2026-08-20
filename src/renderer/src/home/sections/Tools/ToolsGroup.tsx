import { UiIcon } from '@/design/UiIcon'
import { rowSkin, TILE_QUIET } from '@/design/styles'
import { cn } from '@/helpers/cn'

export type Entry = {
  key: string
  icon: string
  label: string
  help: string
  onClick: () => void
}

export function ToolsGroup({ title, entries }: { title: string; entries: readonly Entry[] }) {
  return (
    <div className="bg-surface flex flex-col gap-2 rounded-(--radius-sc-lg) p-3">
      <h3 className="text-muted text-mini m-0 font-semibold tracking-wider uppercase">{title}</h3>

      {/* Tracks the CENTRE rather than the window: Tailwind's breakpoints answer to the viewport,
          and the panel columns beside this band take a third of it without moving one.
          `min(…,100%)` is what keeps the floor from becoming an overflow: the centre is clamped
          at `MIN_CENTER` = 240, which leaves this grid ~168, and the page hides its overflow. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(240px,100%),1fr))] gap-2">
        {entries.map(entry => (
          <button
            key={entry.key}
            type="button"
            onClick={entry.onClick}
            // `rowSkin` rather than the hover and the focus ring written out again — the same
            // answer to "the pointer is here" as every list row. Its radius is overridden below:
            // a tile of the home is wider than a line and takes the larger one.
            className={cn(
              rowSkin(false, { surface: 'tile' }),
              'flex cursor-pointer items-start gap-2.5 text-left',
              'rounded-(--radius-sc-md) border-none bg-transparent p-2 transition-colors',
            )}
          >
            <UiIcon path={entry.icon} size={18} className="text-muted mt-0.5 shrink-0" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-text truncate text-xs leading-normal">{entry.label}</span>
              {/* `TILE_QUIET` and not `ROW_QUIET`: `muted` reads 3.51:1 on `elevated`, the fill
                  this tile takes on hover, and a tile is the last surface in the studio that still
                  takes one — a list row stopped on 2026-08-14. */}
              <span className={cn(TILE_QUIET, 'text-tiny line-clamp-2 leading-snug')}>
                {entry.help}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
