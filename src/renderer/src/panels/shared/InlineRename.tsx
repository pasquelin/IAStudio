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
  /**
   * Whether a commit already happened. Without it, Enter commits and then the unmount fires a
   * SECOND commit with the same name: the caller writes asynchronously, so `value` is still the
   * old name when the field is torn down, and the "was it abandoned mid-type" guard reads true.
   */
  const committed = useRef(false)

  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    latest.current = { draft, onCommit, value }
  })

  useEffect(() => {
    // Both caught while the input is still attached: `closest` from a detached node finds
    // nothing, and by the time the cleanup runs the field is out of the tree.
    const row = field.current?.closest<HTMLElement>('[tabindex]')
    const list = field.current?.closest<HTMLElement>('[role="list"], [role="listbox"]')

    return () => {
      // An input torn out of the tree leaves the focus on `document.body`, so the next Tab
      // restarts from the top of the window — whoever renamed at the keyboard is thrown out of
      // the list they were editing. Given back to the row it started on; and when that row went
      // with it — a sibling added mid-type remounts the rows at new indices — to wherever the
      // list holds its tab stop now, which at least keeps the keyboard inside the list.
      const target = row?.isConnected ? row : list?.querySelector<HTMLElement>('[tabindex="0"]')
      target?.focus()

      if (committed.current) return

      const { draft: typed, onCommit: commit, value: original } = latest.current
      const name = typed.trim()
      if (name && name !== original) commit(name)
    }
  }, [])

  const done = (): void => {
    if (committed.current) return
    committed.current = true

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
      committed.current = true
      onCommit(value)
    }
  }

  return (
    <input
      ref={field}
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
