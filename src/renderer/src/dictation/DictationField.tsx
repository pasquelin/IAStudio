import { useEffect, useState, type ReactNode } from 'react'
import type { FieldDescriptor } from '@shared/domain/model'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useDictation } from '@/hooks/useDictation'
import { useLatest } from '@/hooks/useLatest'
import { useDictation as useSession } from '@/stores/dictation'
import { DictationButton } from './DictationButton'
import { registerDictationTarget } from './destination'
import { Heard } from './Heard'

export type DictationFieldProps = {
  /** Adds a settled sentence to the field this sits in. */
  append: (text: string) => void
}

/**
 * The microphone of one field, and the words as they are still being weighed.
 *
 * The running hypothesis is shown beside the button, not written into the field. Writing it and
 * rewriting it several times a second would destroy the field's own undo history and have
 * react-hook-form re-render on every pass — and the sentence would flicker while being read.
 * Only settled text is appended.
 *
 * **The words are CLAIMED rather than left to the caret**, and that is what this component is
 * for: pressing the button takes the focus off the field it sits in, so the caret path found a
 * `<button>` where it wanted a field and wrote nothing at all — silently, since it answers
 * `false` rather than guessing. Claimed only for the session this button opened: the key opens
 * the next one wherever the caret is, which is what makes dictation work in every other field.
 */
export function DictationField({ append }: DictationFieldProps) {
  const { isListening, enabled } = useDictation()
  const [asked, setAsked] = useState(false)
  const latest = useLatest(append)

  useEffect(() => {
    if (!asked) return

    const release = registerDictationTarget(text => latest.current(text))
    // Subscribed rather than read off a render: `idle` is both where a session starts and where
    // it ends, so the two are told apart by having been live — a refused microphone or a missing
    // model ends one that never listened.
    let live = false
    const unsubscribe = useSession.subscribe(({ state }) => {
      if (state === 'listening' || state === 'loadingEngine') live = true
      else if (live || state !== 'idle') setAsked(false)
    })

    return () => {
      release()
      unsubscribe()
    }
  }, [asked, latest])

  if (!enabled) return null

  return (
    <>
      {isListening && <Heard className="text-tiny min-w-0 flex-1 truncate" />}
      <DictationButton variant="row" tooltip={TIP_LEFT} onStart={() => setAsked(true)} />
    </>
  )
}

/**
 * The dictation a `DynamicForm` hangs in its fields, or nothing.
 *
 * Written here rather than in the panel that renders the form: the rule belongs to the field
 * kind, not to whichever surface happens to draw it.
 */
export function dictationAccessory(
  field: FieldDescriptor,
  append: (text: string) => void,
): ReactNode {
  return field.kind === 'longText' ? <DictationField append={append} /> : null
}
