import { mdiFolderPlusOutline } from '@mdi/js'
import { useState, type KeyboardEvent } from 'react'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { isComposing } from '@/helpers/composition'
import { cn } from '@/helpers/cn'
import { getBridge } from '@/services/bridge'
import { Button } from '../Button'
import { MenuRow } from '../MenuRow'
import { FIELD } from '../styles'

export type FolderFieldCreateProps = {
  /** Where the new folder is made — the one being browsed. */
  folder: string
  labels: {
    /** Already naming the folder — « Nouveau dossier dans "Images" ». The caller interpolates. */
    newFolderIn: string
    newFolderName: string
    newFolderLabel: string
    create: string
    cancel: string
    folderTaken: string
    folderFailed: string
  }
  /** The folder was made: its path, which the field then holds. */
  onCreated: (folder: string) => void
  /** Reads the listing again, so the row that has just appeared is there to be shown. */
  onReread: () => void
}

/**
 * Making a folder from inside the field, so placing a document never sends anyone to the
 * Explorer and back.
 *
 * The parent is NAMED, on the row and again over the field — « Nouveau dossier dans "Images" ».
 * That sentence is the whole reason this component exists twice over: the first version was a
 * bare input at the foot of a tree, and nothing on screen said which folder it would land in.
 * macOS words its own the same way.
 *
 * Committed on the button and on Enter — deliberately NOT on blur, which is what `InlineRename`
 * does: the flyout closes on a press outside, and a blur-commit would make a folder nobody asked
 * for out of a half-typed name.
 */
export function FolderFieldCreate({ folder, labels, onCreated, onReread }: FolderFieldCreateProps) {
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
    // The rows behind bind bare keys, and the menu above answers the arrows: a name typed here
    // must reach neither.
    event.stopPropagation()
    if (isComposing(event)) return
    if (event.key === 'Escape') setDraft(null)
    if (event.key === 'Enter') void create()
  }

  if (draft === null)
    return (
      <MenuRow
        label={labels.newFolderIn}
        icon={mdiFolderPlusOutline}
        tip={HINT_RIGHT(labels.newFolderLabel)}
        onSelect={() => setDraft(labels.newFolderName)}
      />
    )

  return (
    <div className="border-border flex flex-col gap-1.5 border-t p-2">
      <p className="text-muted m-0 text-xs">{labels.newFolderIn}</p>

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

      {/* Spelt out rather than left to Enter: a field with no way out but a key is a field that
          looks stuck to whoever does not try one. */}
      <div className="flex justify-end gap-2">
        <Button onClick={() => setDraft(null)}>{labels.cancel}</Button>
        <Button variant="primary" disabled={draft.trim() === ''} onClick={() => void create()}>
          {labels.create}
        </Button>
      </div>
    </div>
  )
}
