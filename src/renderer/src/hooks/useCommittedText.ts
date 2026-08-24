import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { isComposing } from '@/helpers/composition'

/** What an `<input type="text">` needs to hand its word over on leaving rather than per keystroke. */
export type CommittedText = {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
}

/** Commits on leaving: a write broadcasts to every window, and would hand back a stale word. */
export function useCommittedText(stored: string, commit: (value: string) => void): CommittedText {
  // Null until touched, so a value still on its way from the main process shows up when it lands.
  const [typed, setTyped] = useState<string | null>(null)
  const [known, setKnown] = useState(stored)

  // The stored value moved under the edit — another window, or a restore to default. Dropping
  // what was typed is what makes the field show the new value rather than the word it was left on.
  if (stored !== known) {
    setKnown(stored)
    setTyped(null)
  }

  const settle = (): void => {
    if (typed === null) return

    // Handed back to the stored value, so trailing spaces disappear on the way out; and retyping
    // what is already there would cost a disk write and a broadcast to change nothing.
    setTyped(null)
    if (typed.trim() !== stored) commit(typed.trim())
  }

  return {
    value: typed ?? stored,
    onChange: event => setTyped(event.target.value),
    onBlur: settle,
    onKeyDown: event => {
      // Enter belongs to the input method while it composes — see `isComposing`.
      if (event.key === 'Enter' && !isComposing(event)) settle()
    },
  }
}
