import { useTranslation } from 'react-i18next'
import type { Memory } from '@shared/domain/assistantMemory'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useAssistantMemory } from '@/stores/assistantMemory'

/** Pin it, set it aside, or drop it — the three corrections a person can make to one memory. */
export function MemoryRowActions({ memory }: { memory: Memory }) {
  const { t } = useTranslation()
  const amend = useAssistantMemory(state => state.amend)
  const forget = useAssistantMemory(state => state.forget)
  const promote = useAssistantMemory(state => state.promote)
  // The machine's own memory has nowhere further to be promoted to.
  const ofProject = useAssistantMemory(state => state.scope === 'project')
  const pinned = memory.state === 'pinned'
  const archived = memory.state === 'archived'

  return (
    <div className="flex shrink-0 items-center gap-2">
      {ofProject ? (
        <button
          type="button"
          className="btn btn-xs"
          {...HINT_LEFT(t('settings.memoryPromoteHint'))}
          onClick={() => void promote(memory)}
        >
          {t('settings.memoryPromote')}
        </button>
      ) : null}
      <button
        type="button"
        className="btn btn-xs"
        {...HINT_LEFT(t(pinned ? 'settings.memoryUnpinHint' : 'settings.memoryPinHint'))}
        onClick={() => void amend(memory.id, { state: pinned ? 'live' : 'pinned' })}
      >
        {t(pinned ? 'settings.memoryUnpin' : 'settings.memoryPin')}
      </button>
      <button
        type="button"
        className="btn btn-xs"
        {...HINT_LEFT(t(archived ? 'settings.memoryRestoreHint' : 'settings.memoryArchiveHint'))}
        onClick={() => void amend(memory.id, { state: archived ? 'live' : 'archived' })}
      >
        {t(archived ? 'settings.memoryRestore' : 'settings.memoryArchive')}
      </button>
      <button
        type="button"
        className="btn btn-xs btn-error btn-outline"
        {...HINT_LEFT(t('settings.memoryForgetHint'))}
        onClick={() => void forget(memory.id)}
      >
        {t('settings.memoryForget')}
      </button>
    </div>
  )
}
