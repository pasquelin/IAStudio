import { mdiFolderPlusOutline } from '@mdi/js'
import { useState, type KeyboardEvent } from 'react'
import { isComposing } from '@/helpers/composition'
import { cn } from '@/helpers/cn'
import { getBridge } from '@/services/bridge'
import { Button } from '../Button'
import { UiIcon } from '../UiIcon'
import { FIELD_FILL } from '../styles'

export type FolderPickerCreateProps = {
  /** Where the new folder is made — the one the columns have chosen. */
  folder: string
  labels: {
    /** Already naming the chosen folder — « Nouveau dossier dans Images ». Caller interpolates. */
    newFolderIn: string
    newFolderName: string
    newFolderLabel: string
    create: string
    cancel: string
    folderTaken: string
    folderFailed: string
  }
  /** The folder was made: its path, which becomes the chosen one. */
  onCreated: (folder: string) => void
  /** Reads the chosen folder's column again, so the row that just appeared is drawn. */
  onReread: () => void
}

/**
 * Making a folder without leaving the dialog, in the folder the columns have chosen.
 *
 * Bottom left, which is where every save panel on this machine puts it. The button NAMES its
 * destination rather than saying « New folder » alone: the first version said nothing, and
 * nothing on screen told which folder a new one would land in.
 *
 * Committed on the button and on Enter — deliberately NOT on blur, which is what `InlineRename`
 * does: a blur-commit would make a folder nobody asked for out of a half-typed name.
 */
export function FolderPickerCreate({
  folder,
  labels,
  onCreated,
  onReread,
}: FolderPickerCreateProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  const create = async (): Promise<void> => {
    const name = draft?.trim()
    if (!name) return

    const outcome = await getBridge()
      ?.project.newFolder(folder, name)
      .catch(() => null)

    // What the disk says it made, not what was asked for: the name travels through a parser and
    // a filesystem that both normalise. `from` is empty for something that CAME — `PathChange`.
    const made = outcome?.done[0]?.to
    if (made === undefined) {
      setRefusal(
        outcome?.refused[0]?.reason === 'exists' ? labels.folderTaken : labels.folderFailed,
      )
      return
    }

    onReread()
    setDraft(null)
    setRefusal(null)
    onCreated(made)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // The dialog around it submits on Enter and closes on Escape: a name typed here must reach
    // neither, or naming a folder would make the document.
    event.stopPropagation()
    if (isComposing(event)) return
    if (event.key === 'Escape') setDraft(null)
    if (event.key === 'Enter') void create()
  }

  if (draft === null)
    return (
      <div className="flex pt-2">
        <Button onClick={() => setDraft(labels.newFolderName)} className="gap-1.5">
          <UiIcon path={mdiFolderPlusOutline} size={14} />
          {labels.newFolderIn}
        </Button>
      </div>
    )

  return (
    <div className="flex flex-col gap-1.5 pt-2">
      <label className="text-muted text-xs" htmlFor="sc-folder-picker-name">
        {labels.newFolderIn}
      </label>

      <div className="flex items-center gap-2">
        <input
          autoFocus
          id="sc-folder-picker-name"
          aria-label={labels.newFolderLabel}
          value={draft}
          className={cn(FIELD_FILL, 'text-xs')}
          onChange={event => {
            setDraft(event.target.value)
            setRefusal(null)
          }}
          onKeyDown={onKeyDown}
        />

        {/* Spelt out rather than left to Enter: a field whose only way out is a key looks stuck
            to whoever does not try one. */}
        <Button onClick={() => setDraft(null)}>{labels.cancel}</Button>
        <Button variant="primary" disabled={draft.trim() === ''} onClick={() => void create()}>
          {labels.create}
        </Button>
      </div>

      {refusal && (
        <p role="alert" className="text-warning m-0 text-xs">
          {refusal}
        </p>
      )}
    </div>
  )
}
