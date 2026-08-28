import { useTranslation } from 'react-i18next'
import type { Memory, MemorySourceKind } from '@shared/domain/assistantMemory'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL, WINDOW_HELP } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { formatMoment } from '@/helpers/format'

/**
 * What a memory opens onto: its body, and where it came from.
 *
 * Nothing here is computed for the screen — `source`, `createdAt`, `refs` and `supersedes` are
 * the columns themselves. That is what makes a memory answerable for: the person can see what
 * wrote it and what it replaced, and correct either.
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

      {memory.refs.length > 0 ? (
        <section>
          <h4 className={WINDOW_GROUP_LABEL}>{t('settings.memoryRefs')}</h4>
          <ul className={cn(WINDOW_CAPTION, 'list-inside list-disc')}>
            {memory.refs.map(one => (
              <li key={`${one.kind}:${one.ref}`}>{one.ref}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {memory.links.length > 0 ? (
        <section>
          <h4 className={WINDOW_GROUP_LABEL}>{t('settings.memoryLinks')}</h4>
          <ul className={cn(WINDOW_CAPTION, 'list-inside list-disc')}>
            {memory.links.map(one => (
              <li key={one}>{one}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {memory.supersedes ? (
        <p className={WINDOW_HELP}>{t('settings.memorySupersedes', { id: memory.supersedes })}</p>
      ) : null}
    </div>
  )
}
