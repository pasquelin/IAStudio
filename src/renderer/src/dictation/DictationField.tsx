import type { ReactNode } from 'react'
import type { FieldDescriptor } from '@shared/domain/model'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { DictationButton } from './DictationButton'
import { Heard } from './Heard'
import { useDictation } from '@/hooks/useDictation'

/**
 * The microphone, and the words as they are still being weighed.
 *
 * The running hypothesis is shown BELOW the field, not written into it. Writing it and
 * rewriting it several times a second would destroy the field's own undo history and have
 * react-hook-form re-render on every pass — and the sentence would flicker while being read.
 * Only the settled text is inserted, at the caret.
 *
 * Meant to sit under any field. It holds nothing about the field it sits under: what a settled
 * sentence does is decided by `useDictation`, which puts it where the caret is.
 */
export function DictationField() {
  const { isListening, enabled } = useDictation()

  if (!enabled) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <DictationButton variant="header" tooltip={TIP_BOTTOM} />
      </div>

      {isListening && <Heard className="text-tiny" />}
    </div>
  )
}

/**
 * The dictation a `DynamicForm` hangs under its fields, or nothing.
 *
 * Written here rather than in the panel that renders the form: the rule belongs to the field
 * kind, not to whichever surface happens to draw it.
 */
export function dictationAccessory(field: FieldDescriptor): ReactNode {
  return field.kind === 'longText' ? <DictationField /> : null
}
