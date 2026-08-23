import type { ReactNode } from 'react'
import type { FieldDescriptor } from '@shared/domain/model'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useDictationView } from '@/hooks/useDictationView'
import { DictationButton } from './DictationButton'
import { Heard } from './Heard'

/**
 * The microphone of one field, and the words as they are still being weighed.
 *
 * The running hypothesis is shown beside the button, not written into the field. Writing it and
 * rewriting it several times a second would destroy the field's own undo history and have
 * react-hook-form re-render on every pass — and the sentence would flicker while being read.
 * Only settled text is written.
 *
 * It holds nothing about the field it sits in, and it needs nothing: the strip carrying it keeps
 * the caret in the box, and a settled sentence goes where the caret is. One rule for the button
 * and for ⌥D, which is what a form with three text boxes needs.
 */
export function DictationField() {
  const { isListening, enabled } = useDictationView()

  if (!enabled) return null

  return (
    <>
      {isListening && <Heard className="text-tiny min-w-0 flex-1 truncate" />}
      <DictationButton variant="row" tooltip={TIP_LEFT} />
    </>
  )
}

/**
 * The dictation a `DynamicForm` hangs in its fields, or nothing.
 *
 * Written here rather than in the panel that renders the form: the rule belongs to the field
 * kind, not to whichever surface happens to draw it.
 */
export function dictationAccessory(field: FieldDescriptor): ReactNode {
  return field.kind === 'longText' ? <DictationField /> : null
}
