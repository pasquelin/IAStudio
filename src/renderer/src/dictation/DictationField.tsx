import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { FieldDescriptor } from '@shared/domain/model'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { DictationButton } from './DictationButton'
import { useDictation } from './useDictation'

export type DictationFieldProps = {
  /**
   * What is said while nothing has been heard yet, in place of "Listening…".
   *
   * For the one host whose words do not go to the caret: the assistant claims them while it is
   * up, and a microphone that only says it is open leaves "to whom" unanswered. Every other site
   * dictates into the field beside it, where the question does not arise.
   */
  listeningLabel?: string
}

/**
 * The microphone, and the words as they are still being weighed.
 *
 * The running hypothesis is shown BELOW the field, not written into it. Writing it and
 * rewriting it several times a second would destroy the field's own undo history and have
 * react-hook-form re-render on every pass — and the sentence would flicker while being read.
 * Only the settled text is inserted, at the caret.
 *
 * Meant to sit under any field. It holds nothing about the field it sits under: what a settled
 * sentence does is decided by `useDictation`, which puts it where the caret is — or hands it to
 * whoever claimed it.
 */
export function DictationField({ listeningLabel }: DictationFieldProps = {}) {
  const { t } = useTranslation()
  const { partial, isListening, enabled } = useDictation()

  if (!enabled) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <DictationButton variant="header" tooltip={TIP_BOTTOM} />
      </div>

      {/*
        Not a live region. The hypothesis is replaced about every 700 ms and each one is the
        whole sentence so far, never a delta: announced politely, they queue up and the reader
        falls further behind the voice with every pass. What settles goes into the field, which
        a screen reader follows on its own.
      */}
      {isListening && (
        <p aria-live="off" className="text-muted text-tiny italic">
          {partial || listeningLabel || t('dictation.listening')}
        </p>
      )}
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
