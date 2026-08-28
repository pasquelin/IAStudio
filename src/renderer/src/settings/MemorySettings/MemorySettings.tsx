import { useEffect, useState } from 'react'
import { useDebounced, SEARCH_DELAY_MS } from '@/hooks/useDebounced'
import { useTranslation } from 'react-i18next'
import { mdiBrain } from '@mdi/js'
import {
  MEMORY_STATES,
  MEMORY_TYPES,
  type MemoryScope,
  type MemoryState,
  type MemoryType,
} from '@shared/domain/assistantMemory'
import { Collection } from '@/design/Collection/Collection'
import { EmptyState } from '@/design/EmptyState'
import { WindowChip } from '@/design/WindowChip'
import { WindowSearch } from '@/design/WindowSearch'
import { WINDOW_CAPTION } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { useAssistantMemory } from '@/stores/assistantMemory'
import { useProject } from '@/stores/project'
import { SETTING_COLUMN, SETTING_SELECT } from '../settingStyles'
import { MemoryRelations } from './MemoryRelations'
import { MemoryRowActions } from './MemoryRowActions'
import { MemoryRowDetail } from './MemoryRowDetail'
import { MemoryUpkeep } from './MemoryUpkeep'

/**
 * What the assistant has learned, and the only screen that can correct it.
 *
 * 🛑 The panel asks for a listing when it OPENS, and never on mount: the memory thread opens
 * lazily, and a store connected at boot would have every window pay for a database nobody has
 * asked a question of.
 */

/** Archived rows are listed too — the point of archiving is that it stays readable. */
const SHOWN: readonly MemoryState[] = MEMORY_STATES.filter(one => one !== 'dropped')

export function MemorySettings() {
  const { t } = useTranslation()
  const memories = useAssistantMemory(state => state.memories)
  const loaded = useAssistantMemory(state => state.loaded)
  const look = useAssistantMemory(state => state.look)
  // 🛑 Which of « nothing learned » and « no project open » is true is not the memory's to know:
  // its `project` scope answers an empty list for both, and the two ask for opposite things.
  const opened = useProject(state => state.project !== null)
  // Held HERE and handed to `look`, rather than read back off the store: the store's own scope
  // moves when the listing lands, so a chip reading it would light up a beat after the click.
  const [scope, setScope] = useState<MemoryScope>('project')
  const [text, setText] = useState('')
  // 🛑 Debounced, or every keystroke clears the list, crosses IPC and pays an FTS scan on the
  // memory thread — for an answer the next keystroke throws away.
  const searched = useDebounced(text.trim(), SEARCH_DELAY_MS)
  const [type, setType] = useState<MemoryType | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    // The one place a listing is asked for. `look` carries the scope AND the filters, so the
    // panel never holds a query the store disagrees with.
    void look(scope, {
      states: SHOWN,
      ...(searched ? { text: searched } : {}),
      ...(type ? { types: [type] } : {}),
    })
  }, [look, scope, searched, type])

  return (
    <div className={cn(SETTING_COLUMN, 'mt-6 gap-4')}>
      {/* `WindowChip` and not `Chip`: the settings window is not a dock — see its own file. */}
      <div className="flex gap-2">
        <WindowChip
          label={t('settings.memoryProject')}
          hint={t('settings.memoryProjectHint')}
          selected={scope === 'project'}
          onClick={() => setScope('project')}
        />
        <WindowChip
          label={t('settings.memoryGlobal')}
          hint={t('settings.memoryGlobalHint')}
          selected={scope === 'global'}
          onClick={() => setScope('global')}
        />
      </div>

      <div className="flex gap-2">
        {/* 🛑 Wrapped: `WindowSearch` is `w-full shrink-0`, which is its COLUMN behaviour — in a
            row it took the whole width and pushed the filter off the edge of the window. */}
        <div className="min-w-0 grow">
          <WindowSearch label={t('settings.memorySearch')} value={text} onChange={setText} />
        </div>
        <select
          data-sc="field:memory.type"
          aria-label={t('settings.memoryFilterAll')}
          className={cn(SETTING_SELECT, 'shrink-0')}
          value={type}
          onChange={event => setType(event.target.value as MemoryType | '')}
        >
          <option value="">{t('settings.memoryFilterAll')}</option>
          {MEMORY_TYPES.map(one => (
            <option key={one} value={one}>
              {t(`memoryTypes.${one}`)}
            </option>
          ))}
        </select>
      </div>

      <p className={WINDOW_CAPTION}>{t('settings.memoryCount', { count: memories.length })}</p>

      <div className="h-80">
        <Collection
          items={memories}
          label={t('settings.memory')}
          expandedId={openId}
          onToggleRow={one => setOpenId(openId === one.id ? null : one.id)}
          renderRowDetail={one => (
            <>
              <MemoryRowDetail memory={one} />
              <MemoryRelations memory={one} among={memories} onOpen={setOpenId} />
            </>
          )}
          renderRow={one => (
            <div className="flex w-full items-center gap-2">
              <span className="grow truncate text-xs">{one.summary}</span>
              <span className={WINDOW_CAPTION}>{t(`memoryTypes.${one.type}`)}</span>
              <MemoryRowActions memory={one} />
            </div>
          )}
          empty={
            <EmptyState
              icon={mdiBrain}
              message={emptyMessage(t, {
                loaded,
                scope,
                opened,
                searching: text.trim().length > 0,
              })}
            />
          }
        />
      </div>

      <MemoryUpkeep memories={memories} />
    </div>
  )
}

/**
 * Empty, unmatched, or a studio with no project open — three different things to say, and a
 * fourth that says nothing at all.
 *
 * 🛑 Silent while the first answer is on its way: `loaded` exists precisely so a panel drawn
 * before it does not claim « nothing learned », and the branch that did was the one it guards.
 * And « open a project » is only true when none IS open — the memory answers an empty list for
 * both cases, so the project store is what tells them apart.
 */
function emptyMessage(
  t: (key: string) => string,
  where: { loaded: boolean; scope: MemoryScope; opened: boolean; searching: boolean },
): string {
  if (!where.loaded) return ''
  if (where.searching) return t('settings.memoryUnmatched')
  if (where.scope === 'project' && !where.opened) return t('settings.memoryNoProject')

  return t('settings.memoryEmpty')
}
