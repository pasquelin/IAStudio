import {
  mdiArchiveArrowDownOutline,
  mdiArchiveArrowUpOutline,
  mdiEarthPlus,
  mdiPinOffOutline,
  mdiPinOutline,
  mdiTrashCanOutline,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Memory } from '@shared/domain/assistantMemory'
import { WindowIconButton } from '@/components/WindowIconButton'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useAssistantMemory } from '@/stores/assistantMemory'

/**
 * Pin it, set it aside, or drop it — the three corrections a person can make to one memory.
 *
 * 🛑 Glyphs, and the width is the reason: four LABELS took half the row, and the summary they act
 * on — which is the whole of what a person reads here — was truncated to nothing beside them. It
 * is also what the rest of these windows do at the end of a row (Git, MCP, Storage), where this
 * was the one family in `btn-xs` text.
 */
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
    <div className="flex shrink-0 items-center">
      {ofProject ? (
        <WindowIconButton
          path={mdiEarthPlus}
          label={t('settings.memoryPromote')}
          tooltip={HINT_LEFT(t('settings.memoryPromoteHint'))}
          onClick={() => void promote(memory)}
        />
      ) : null}
      <WindowIconButton
        path={pinned ? mdiPinOffOutline : mdiPinOutline}
        label={t(pinned ? 'settings.memoryUnpin' : 'settings.memoryPin')}
        tooltip={HINT_LEFT(t(pinned ? 'settings.memoryUnpinHint' : 'settings.memoryPinHint'))}
        onClick={() => void amend(memory.id, { state: pinned ? 'live' : 'pinned' })}
      />
      <WindowIconButton
        path={archived ? mdiArchiveArrowUpOutline : mdiArchiveArrowDownOutline}
        label={t(archived ? 'settings.memoryRestore' : 'settings.memoryArchive')}
        tooltip={HINT_LEFT(
          t(archived ? 'settings.memoryRestoreHint' : 'settings.memoryArchiveHint'),
        )}
        onClick={() => void amend(memory.id, { state: archived ? 'live' : 'archived' })}
      />
      <WindowIconButton
        path={mdiTrashCanOutline}
        label={t('settings.memoryForget')}
        tooltip={HINT_LEFT(t('settings.memoryForgetHint'))}
        // The one that cannot be taken back keeps the warning colour a glyph would otherwise lose.
        className="text-error"
        onClick={() => void forget(memory.id)}
      />
    </div>
  )
}
