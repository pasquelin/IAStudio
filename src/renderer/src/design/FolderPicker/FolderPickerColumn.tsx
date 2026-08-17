import { mdiChevronRight, mdiFolderOutline } from '@mdi/js'
import type { KeyboardEvent } from 'react'
import type { FolderColumn } from '@/hooks/useFolderColumns'
import { cn } from '@/helpers/cn'
import { Row } from '../Row'
import { rowSkin } from '../styles'
import { UiIcon } from '../UiIcon'

export type FolderPickerColumnProps = {
  column: FolderColumn
  /** The folder chosen IN this column, if the walk goes on past it. */
  chosen: string | undefined
  onPick: (folder: string) => void
  /** Already translated — shown in place of the rows when the folder holds no sub-folder. */
  emptyLabel: string
  /** Names the column for a reader, since a listbox with no name is announced as « list box ». */
  label: string
}

/**
 * What one folder holds, as its own column.
 *
 * A listbox rather than a row of buttons: a column is a set of alternatives of which one is
 * chosen, which is what `aria-selected` says and what a button cannot. `Row` draws the line, so
 * this column keeps the height and the truncation every other list of the studio has.
 */
export function FolderPickerColumn({
  column,
  chosen,
  onPick,
  emptyLabel,
  label,
}: FolderPickerColumnProps) {
  if (column.read && column.entries.length === 0)
    return (
      <p className="text-muted m-0 w-(--sc-folder-column) shrink-0 px-2 py-1.5 text-xs">
        {emptyLabel}
      </p>
    )

  const onKeyDown = (folder: string) => (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onPick(folder)
  }

  return (
    <div
      role="listbox"
      aria-label={label}
      // The half-step between rows is the menu's own: names run together without it, and a
      // column of folder names is read by scanning rather than line by line.
      className="flex w-(--sc-folder-column) shrink-0 flex-col gap-0.5 overflow-y-auto p-1"
    >
      {column.entries.map(entry => (
        <div
          key={entry.path}
          role="option"
          aria-selected={entry.path === chosen}
          // Both, and on the same element: `aria-selected` is what a reader hears, `data-selected`
          // is what lifts the row's own words out of `muted` on the picked fill.
          data-selected={entry.path === chosen ? '' : undefined}
          tabIndex={0}
          onClick={() => onPick(entry.path)}
          onKeyDown={onKeyDown(entry.path)}
          // The gauge, and it has to be HERE: `Row` draws itself at `h-full`, so a parent with no
          // height of its own leaves every line as tall as its text — `Tree` gives its rows one
          // through the virtualizer, and a list that does not is the one that reads cramped.
          className={cn(rowSkin(entry.path === chosen), 'h-(--sc-control) cursor-pointer')}
        >
          <Row
            icon={mdiFolderOutline}
            title={entry.name}
            // What says a folder opens a column of its own — the Finder draws the same one. The
            // quiet ink rather than an opacity: it is a glyph that informs, held to 3:1 (1.4.11).
            actions={<UiIcon path={mdiChevronRight} size={12} className="text-muted" />}
          />
        </div>
      ))}
    </div>
  )
}
