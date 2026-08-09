import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { FieldDescriptor } from '@shared/domain/model'
import { DictationButton } from './DictationButton'
import { useDictation } from './useDictation'

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
  const { t } = useTranslation()
  const { partial, isListening, enabled } = useDictation()

  if (!enabled) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end">
        <DictationButton variant="header" />
      </div>

      {isListening && (
        <p role="status" aria-live="polite" className="text-muted text-[11px] italic">
          {partial || t('dictation.listening')}
        </p>
      )}
    </div>
  )
}

/**
 * The dictation a `DynamicForm` hangs under its fields, or nothing.
 *
 * Written here rather than in each panel: `Generator` and `Apps` render the same form from the
 * same descriptors, and the second one had no dictation at all because the rule lived in the
 * first.
 */
export function dictationAccessory(field: FieldDescriptor): ReactNode {
  return field.kind === 'longText' ? <DictationField /> : null
}
