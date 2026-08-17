import { useState } from 'react'
import { FIELD_FILL } from './styles'
import { isComposing } from '@/helpers/composition'

export type NameFieldProps = {
  /** Accessible name and, when nothing is typed yet, what the field is for. */
  label: string
  placeholder: string
  /** Whether what is typed may be submitted. Enter does nothing while it answers false. */
  accepts: (name: string) => boolean
  onSubmit: (name: string) => void
  onCancel: () => void
}

/**
 * A name typed once, on the spot, in place of the control that asked for it.
 *
 * A field rather than a dialogue, and that is the whole shape: a modal window over the studio to
 * type six characters makes a branch or a tag feel like a decision, where both exist precisely so
 * that trying something costs nothing.
 *
 * `isComposing` is why this is written once rather than twice. A Japanese or Chinese keyboard
 * sends Enter to CLOSE its candidate list, and a field that acted on that Enter would create a
 * branch called by the half-word being composed. Every field in the studio already asks —
 * `InlineRename`, the settings rows, the document dialogue — and the two that did not were the
 * two copies this replaces.
 *
 * Leaving the field ABANDONS. Nothing here is a value being edited: a half-typed name that
 * became a branch because the pointer moved is a branch nobody asked for.
 *
 * **It takes no `disabled`, and that is a fix rather than an omission.** It used to be greyed
 * while a git command ran, which the version panels raise for any command at all — including the
 * refresh a folder watch fires while the studio writes an asset. A browser blurs what it
 * disables, the blur abandons, and the name being typed went with it, mid-word.
 */
export function NameField({ label, placeholder, accepts, onSubmit, onCancel }: NameFieldProps) {
  const [name, setName] = useState('')

  return (
    <input
      // Focused on sight: the field replaced the control that was just clicked, and asking for a
      // second click to type into what one asked for reads as the gesture having failed.
      autoFocus
      type="text"
      value={name}
      aria-label={label}
      placeholder={placeholder}
      className={FIELD_FILL}
      onChange={event => setName(event.target.value)}
      onKeyDown={event => {
        if (isComposing(event)) return

        if (event.key === 'Enter' && accepts(name)) onSubmit(name)
        if (event.key === 'Escape') onCancel()
      }}
      onBlur={onCancel}
    />
  )
}
