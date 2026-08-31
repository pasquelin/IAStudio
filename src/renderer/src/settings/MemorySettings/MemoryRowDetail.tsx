import { useTranslation } from 'react-i18next'
import type { Memory, MemorySourceKind } from '@shared/domain/assistantMemory'
import { WINDOW_CAPTION, WINDOW_HELP } from '@/components/windowStyles'
import { formatMoment } from '@/helpers/format'

/**
 * What a memory opens onto: its body, and where it came from.
 *
 * 🛑 What it points AT is not here — `MemoryRelations` draws the same four relations beside it,
 * with the relation named and the target's summary rather than its id. Both were stacked in one
 * row detail, the poorer version above the better one.
 */

const SOURCE_KEYS: Readonly<Record<MemorySourceKind, string>> = {
  action: 'settings.memorySourceAction',
  person: 'settings.memorySourcePerson',
  assistant: 'settings.memorySourceAssistant',
  import: 'settings.memorySourceImport',
}

export function MemoryRowDetail({ memory }: { memory: Memory }) {
  const { t, i18n } = useTranslation()

  return (
    <div className="flex flex-col gap-3 py-2 pl-6">
      {memory.body ? <p className={WINDOW_CAPTION}>{memory.body}</p> : null}

      <p className={WINDOW_HELP}>
        {t('settings.memorySource')}{' '}
        {t(SOURCE_KEYS[memory.source.kind], { ref: memory.source.ref })}
        {' · '}
        {formatMoment(memory.createdAt, i18n.language, 'local')}
      </p>
    </div>
  )
}
