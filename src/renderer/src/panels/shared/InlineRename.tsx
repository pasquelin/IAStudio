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
    /**
     * Held in a variable rather than read back from the ref, and that is the whole of the guard
     * below: React has already cleared `field.current` by the time a cleanup runs, so the cleanup
     * cannot ask the ref whether the field is still on screen.
     */
    const node = field.current

    /**
     * Taken from the effect and not left to `autoFocus` alone, and StrictMode is the reason: it
     * runs mount → cleanup → mount again, and that cleanup hands the focus back to the row. The
     * attribute fires once, at creation, so the field was left OPEN AND UNFOCUSED — a rename that
     * looks like nothing happened, and typing goes to the list instead.
     *
     * Focusing here is idempotent, so the second run puts it back. `autoFocus` stays: it lands a
     * frame earlier, before this effect, and nothing is gained by making the field flash unfocused.
     */
    node?.focus()

    // Both caught while the input is still attached: `closest` from a detached node finds
    // nothing, and by the time the cleanup runs the field is out of the tree.
    const row = node?.closest<HTMLElement>('[tabindex]')
    // `tree` among them: the explorer renames inside one, so without it this fallback was dead
    // in the one list whose rows a folder watch can tear out from under the field.
    const list = node?.closest<HTMLElement>('[role="list"], [role="listbox"], [role="tree"]')

    return () => {
      /**
       * StrictMode replays mount → cleanup → mount on a field that never left the screen, and this
       * cleanup used to take the focus off it anyway — which `onBlur` reads as a commit, so the
       * owner closed the field a frame after opening it. Every rename in the studio opened and
       * shut in the same frame, looking from the outside like a gesture that did nothing.
       *
       * Measured over CDP in Electron on 13 August: the replayed cleanup sees `isConnected` true,
       * a real unmount sees it false. That is the only signal that tells the two apart here.
       */
      if (node?.isConnected) return

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
