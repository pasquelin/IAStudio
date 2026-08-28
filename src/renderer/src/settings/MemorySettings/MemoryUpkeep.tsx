import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { Memory } from '@shared/domain/assistantMemory'
import { duplicatesIn, staleIn } from '@shared/domain/memoryUpkeep'
import { WINDOW_GROUP_LABEL, WINDOW_HELP } from '@/design/windowStyles'
import { SettingLine } from '../SettingLine'
import { useAssistantMemory } from '@/stores/assistantMemory'
import { MemoryAction } from './MemoryAction'

/**
 * What keeps a memory of six months readable: embed what is missing, merge what says the same
 * thing twice, set aside what nothing has drawn on, rewrite the file, or erase it.
 *
 * 🛑 Counted from what is ON SCREEN. The gestures act on the listing, so a count read from
 * anywhere else would offer to merge memories a filter is hiding.
 */
export function MemoryUpkeep({ memories }: { memories: readonly Memory[] }) {
  const { t } = useTranslation()
  const pending = useAssistantMemory(state => state.pending)
  const indexing = useAssistantMemory(state => state.indexing)
  const rebuild = useAssistantMemory(state => state.rebuild)
  const reset = useAssistantMemory(state => state.reset)
  const index = useAssistantMemory(state => state.index)
  const stopIndex = useAssistantMemory(state => state.stopIndex)
  const mergeDuplicates = useAssistantMemory(state => state.mergeDuplicates)
  const archiveStale = useAssistantMemory(state => state.archiveStale)
  const compact = useAssistantMemory(state => state.compact)

  // 🛑 Both walk every memory on screen, and the store walks them AGAIN on the click: recomputing
  // them on each render paid that walk for a pointer moving over a row.
  const duplicates = useMemo(
    () => duplicatesIn(memories).reduce((sum, group) => sum + group.length - 1, 0),
    [memories],
  )
  // 🛑 The clock is read ONCE, and it is the one `archiveStale` is given: two `new Date()` — the
  // sentence's and the click's — could archive a memory the count did not include.
  const { now, sleeping } = useMemo(() => {
    const at = new Date().toISOString()
    return { now: at, sleeping: staleIn(memories, at).length }
  }, [memories])

  return (
    <section>
      <h3 className={WINDOW_GROUP_LABEL}>{t('settings.memory')}</h3>

      <MemoryAction
        title={t('settings.memoryReindex')}
        help={t('settings.memoryReindexHelp')}
        button={t('settings.memoryReindex')}
        onRun={() => void rebuild()}
      />

      {/* The only one that is not one button: a run under way is stopped, never started twice. */}
      <SettingLine
        title={t('settings.memoryEmbed')}
        help={
          <p className={WINDOW_HELP}>
            {pending === 0
              ? t('settings.memoryEmbedNone')
              : t('settings.memoryEmbedPending', { count: pending })}
          </p>
        }
      >
        {indexing ? (
          <button type="button" className="btn btn-sm" onClick={() => void stopIndex()}>
            {t('settings.memoryStopEmbed')}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={pending === 0}
            onClick={() => void index()}
          >
            {t('settings.memoryEmbed')}
          </button>
        )}
      </SettingLine>

      <MemoryAction
        title={t('settings.memoryMerge')}
        help={
          duplicates === 0
            ? t('settings.memoryMergeNone')
            : t('settings.memoryMergeFound', { count: duplicates })
        }
        button={t('settings.memoryMerge')}
        disabled={duplicates === 0}
        onRun={() => void mergeDuplicates()}
      />

      <MemoryAction
        title={t('settings.memoryStale')}
        help={
          sleeping === 0
            ? t('settings.memoryStaleNone')
            : t('settings.memoryStaleFound', { count: sleeping })
        }
        button={t('settings.memoryStale')}
        disabled={sleeping === 0}
        onRun={() => void archiveStale(now)}
      />

      <MemoryAction
        title={t('settings.memoryCompact')}
        help={t('settings.memoryCompactHelp')}
        button={t('settings.memoryCompact')}
        onRun={() => void compact()}
      />

      <MemoryAction
        title={t('settings.memoryPurge')}
        help={t('settings.memoryPurgeHelp')}
        button={t('settings.memoryPurge')}
        confirm="settings.memoryPurgeConfirm"
        onRun={() => void reset()}
      />
    </section>
  )
}
