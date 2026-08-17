import { mdiFolderPlusOutline } from '@mdi/js'
import { useState, type KeyboardEvent } from 'react'
import { pathIn } from '@shared/domain/folder'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { isComposing } from '@/helpers/composition'
import { cn } from '@/helpers/cn'
import { getBridge } from '@/services/bridge'
import { MenuRow } from '../MenuRow'
import { FIELD } from '../styles'

export type FolderFieldCreateProps = {
  /** Where the new folder is made — the one the field currently holds. */
  folder: string
  labels: {
    newFolder: string
    newFolderName: string
    newFolderLabel: string
    folderTaken: string
    folderFailed: string
  }
  /** The folder was made: its path, which the field then holds. */
  onCreated: (folder: string) => void
  /** Reads the tree again, so the row that has just appeared is there to be shown. */
  onReread: () => void
}

/**
 * Making a folder from inside the field, so placing a document never sends anyone to the
 * Explorer and back.
 *
 * Committed on Enter and on the row alone — deliberately NOT on blur, which is what
 * `InlineRename` does: the flyout closes on a press outside, and a blur-commit would make a
 * folder nobody asked for out of a half-typed name.
 */
export function FolderFieldCreate({ folder, labels, onCreated, onReread }: FolderFieldCreateProps) {
  const [draft, setDraft] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)

  const create = async (name: string): Promise<void> => {
    const outcome = await getBridge()
      ?.project.newFolder(folder, name)
      .catch(() => null)

    if (!outcome || outcome.done.length === 0) {
      setRefusal(
        outcome?.refused[0]?.reason === 'exists' ? labels.folderTaken : labels.folderFailed,
      )
      return
    }

    onReread()
    setDraft(null)
    setRefusal(null)
    onCreated(pathIn(folder, name))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // The rows behind bind bare keys, and the tree above answers the arrows: a name typed here
    // must reach neither.
    event.stopPropagation()
    if (event.key === 'Escape' && !isComposing(event)) setDraft(null)
    if (event.key !== 'Enter' || isComposing(event)) return

    const name = draft?.trim()
    if (name) void create(name)
  }

  if (draft === null)
    return (
      <MenuRow
        label={labels.newFolder}
        icon={mdiFolderPlusOutline}
        tip={HINT_RIGHT(labels.newFolderLabel)}
        onSelect={() => setDraft(labels.newFolderName)}
      />
    )

  return (
    <div className="flex flex-col gap-1.5 p-1">
      <input
        autoFocus
        aria-label={labels.newFolderLabel}
        value={draft}
        className={cn(FIELD, 'w-full text-xs')}
        onChange={event => {
          setDraft(event.target.value)
          setRefusal(null)
        }}
        onKeyDown={onKeyDown}
      />
      {refusal && (
        <p role="alert" className="text-warning m-0 text-xs">
          {refusal}
        </p>
      )}
    </div>
  )
}
