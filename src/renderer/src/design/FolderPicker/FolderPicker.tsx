import { Fragment } from 'react'
import { FOLDER_ROOT, folderTrail, nameOf } from '@shared/domain/folder'
import { useFolderColumns } from '@/hooks/useFolderColumns'
import { FolderPickerColumn } from './FolderPickerColumn'
import { FolderPickerCreate } from './FolderPickerCreate'

export type FolderPickerProps = {
  /** The chosen folder, relative to the project. `FOLDER_ROOT` is the project folder itself. */
  value: string
  onChange: (folder: string) => void
  /** The project's own name, which is what the first column is headed with. */
  rootName: string
  /**
   * Every word this draws, already translated: it draws what it is handed and looks nothing up,
   * the way every other component of `design/` does.
   */
  labels: {
    columns: string
    empty: string
    /** Already naming the chosen folder — the caller interpolates. */
    newFolderIn: string
    newFolderName: string
    newFolderLabel: string
    create: string
    cancel: string
    folderTaken: string
    folderFailed: string
  }
}

/**
 * Where something goes in the project, picked in COLUMNS — the Finder's browser, and the shape
 * every save panel on this machine opens on.
 *
 * One column per level: picking a folder opens its own column beside it and makes it the answer.
 * There is one notion and not two — where you are IS where it goes — which is what a tree could
 * not say and what a drop-down plus a breadcrumb said twice.
 *
 * The walk is the whole of the state: picking a folder higher up drops every column past it.
 */
export function FolderPicker({ value, onChange, rootName, labels }: FolderPickerProps) {
  const { columns, reread } = useFolderColumns(value)
  const trail = folderTrail(value)

  return (
    <div className="flex flex-col">
      <div
        role="group"
        aria-label={labels.columns}
        className="border-border h-64 overflow-x-auto rounded-(--radius-sc-sm) border"
      >
        <div className="flex h-full min-w-min">
          {columns.map((column, index) => (
            <Fragment key={column.folder}>
              {index > 0 && <div className="bg-border w-px shrink-0" aria-hidden="true" />}
              <FolderPickerColumn
                column={column}
                // The next step of the walk is what this column has chosen — and the last column
                // has chosen nothing, which is what leaves it with no row lit.
                chosen={trail[index + 1]}
                onPick={onChange}
                emptyLabel={labels.empty}
                label={column.folder === FOLDER_ROOT ? rootName : nameOf(column.folder)}
              />
            </Fragment>
          ))}
        </div>
      </div>

      <FolderPickerCreate
        folder={value}
        labels={labels}
        onCreated={onChange}
        onReread={() => reread(value)}
      />

      {/* Where the document will be written, spelt out under the columns: the lit rows say it
          too, but only for whoever reads three columns at once. */}
      <p className="text-muted m-0 truncate pt-2 text-xs">
        {trail.map(folder => (folder === FOLDER_ROOT ? rootName : nameOf(folder))).join(' / ')}
      </p>
    </div>
  )
}
