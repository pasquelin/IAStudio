import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { FIELD, FOCUS_RING } from '@/design/styles'
import { cn } from '@/helpers/cn'

export type InlineRenameProps = {
  value: string
  /** Already translated: the field draws what it is handed and looks nothing up. */
  label: string
  /** Fired with the trimmed name. Never with an empty one — a nameless row cannot be found. */
  onCommit: (name: string) => void
}

/**
 * A name, edited where it is read. Written once for the layer stack and the track headers: what
 * makes it subtle is not the input, it is when the edit ends.
 *
 * Committed on Enter, on blur, and on unmount. The last one is the one that bites: both lists
 * are virtualized and re-key their rows on every change, so a layer added while a name is being
 * typed tears the field out of the tree — and React fires no blur for an input it unmounts.
 */
export function InlineRename({ value, label, onCommit }: InlineRenameProps) {
  const [draft, setDraft] = useState(value)
  // Read by the unmount cleanup, which must not re-run on every keystroke to see the last one.
  const latest = useRef({ draft, onCommit, value })

  useEffect(() => {
    latest.current = { draft, onCommit, value }
  })

  useEffect(() => {
    return () => {
      const { draft: typed, onCommit: commit, value: original } = latest.current
      const name = typed.trim()
      if (name && name !== original) commit(name)
    }
  }, [])

  const done = (): void => {
    const name = draft.trim()
    onCommit(name || value)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    // Stopped here: the surfaces around these lists bind bare letters, and typing a name must
    // not arm a tool or split a clip.
    event.stopPropagation()
    if (event.key === 'Enter') done()
    if (event.key === 'Escape') {
      // Restored first, so neither the blur nor the unmount writes what was abandoned.
      setDraft(value)
      latest.current = { ...latest.current, draft: value }
      onCommit(value)
    }
  }

  return (
    <input
      autoFocus
      aria-label={label}
      value={draft}
      className={cn(FIELD, FOCUS_RING, 'w-full')}
      onPointerDown={event => event.stopPropagation()}
      onChange={event => setDraft(event.target.value)}
      onBlur={done}
      onKeyDown={onKeyDown}
    />
  )
}
