import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isComposing } from '@/helpers/composition'
import type { CommittedProps } from './controls'

/** Text settings commit on blur; a controlled input fed by a write hands back a stale word. */
export function SettingRowTextControl({
  descriptor,
  id,
  describedBy,
  stored,
  onCommit,
}: CommittedProps) {
  const { t } = useTranslation()
  // Null until touched, so a setting still on its way from the main process shows up when it
  // lands — seeding once would display an empty field over a stored value.
  const [typed, setTyped] = useState<string | null>(null)
  const [known, setKnown] = useState(stored)

  // The stored value moved under the edit — restored to its default, or changed by another
  // window. Dropping what was typed is what makes the field show the new value rather than
  // the word it was left on.
  if (stored !== known) {
    setKnown(stored)
    setTyped(null)
  }

  const commit = (): void => {
    if (typed === null) return
    const trimmed = typed.trim()

    // Handing the field back to the stored value, so trailing spaces disappear on the way out
    // rather than staying on screen — `stored` would not move, and nothing else clears this.
    setTyped(null)

    // Retyping what is already stored would cost a disk write and a broadcast to every
    // window, to change nothing.
    if (trimmed !== String(stored ?? '')) onCommit(trimmed)
  }

  return (
    <input
      id={id}
      data-sc={`field:${id}`}
      aria-describedby={describedBy}
      className="input input-sm w-full max-w-xs"
      type="text"
      placeholder={descriptor.placeholderKey ? t(descriptor.placeholderKey) : undefined}
      value={typed ?? String(stored ?? '')}
      onChange={event => setTyped(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        // Enter belongs to the input method while it composes — see `isComposing`.
        if (event.key === 'Enter' && !isComposing(event)) commit()
      }}
    />
  )
}
