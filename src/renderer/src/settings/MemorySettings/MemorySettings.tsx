import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { mdiBrain } from '@mdi/js'
import {
  MEMORY_STATES,
  MEMORY_TYPES,
  type Memory,
  type MemoryScope,
  type MemoryState,
  type MemoryType,
} from '@shared/domain/assistantMemory'
import { Chip } from '@/design/Chip'
import { Collection } from '@/design/Collection/Collection'
import { EmptyState } from '@/design/EmptyState'
import { WindowSearch } from '@/design/WindowSearch'
import { WINDOW_CAPTION, WINDOW_GROUP_LABEL, WINDOW_HELP } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { HINT_LEFT } from '@/helpers/tooltip'
import { duplicatesIn, staleIn } from '@shared/domain/memoryUpkeep'
import { useAssistantMemory } from '@/stores/assistantMemory'
import { SettingLine } from '../SettingLine'
import { SETTING_COLUMN, SETTING_SELECT } from '../settingStyles'
import { MemoryRelations } from './MemoryRelations'
import { MemoryRowDetail } from './MemoryRowDetail'

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
  const { memories, loaded, pending, indexing } = useAssistantMemory()
  const { look, amend, forget, rebuild, reset, index, stopIndex } = useAssistantMemory()
  const { mergeDuplicates, archiveStale, compact } = useAssistantMemory()
  // Held HERE and handed to `look`, rather than read back off the store: the store's own scope
  // moves when the listing lands, so a chip reading it would light up a beat after the click.
  const [scope, setScope] = useState<MemoryScope>('project')
  const [text, setText] = useState('')
  const [type, setType] = useState<MemoryType | ''>('')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    // The one place a listing is asked for. `look` carries the scope AND the filters, so the
    // panel never holds a query the store disagrees with.
    void look(scope, {
      states: SHOWN,
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(type ? { types: [type] } : {}),
    })
  }, [look, scope, text, type])

  // Counted from what is ON SCREEN: the gestures below act on the listing, so a count read from
  // anywhere else would offer to merge memories a filter is hiding.
  const duplicates = duplicatesIn(memories).reduce((sum, group) => sum + group.length - 1, 0)
  const sleeping = staleIn(memories, new Date().toISOString()).length

  const rowActions = (memory: Memory) => {
    const pinned = memory.state === 'pinned'
    const archived = memory.state === 'archived'

    return (
      <div className="flex shrink-0 items-center gap-2">
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

  return (
    <div className={cn(SETTING_COLUMN, 'mt-6 gap-4')}>
      <div className="flex gap-2">
        <Chip
          label={t('settings.memoryProject')}
          hint={t('settings.memoryProjectHint')}
          selected={scope === 'project'}
          onClick={() => setScope('project')}
        />
        <Chip
          label={t('settings.memoryGlobal')}
          hint={t('settings.memoryGlobalHint')}
          selected={scope === 'global'}
          onClick={() => setScope('global')}
        />
      </div>

      <div className="flex gap-2">
        <WindowSearch label={t('settings.memorySearch')} value={text} onChange={setText} />
        <select
          data-sc="field:memory.type"
          aria-label={t('settings.memoryFilterAll')}
          className={SETTING_SELECT}
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
              <MemoryRelations memory={one} among={memories} />
            </>
          )}
          renderRow={one => (
            <div className="flex w-full items-center gap-2">
              <span className="grow truncate text-xs">{one.summary}</span>
              <span className={WINDOW_CAPTION}>{t(`memoryTypes.${one.type}`)}</span>
              {rowActions(one)}
            </div>
          )}
          empty={
            <EmptyState
              icon={mdiBrain}
              message={emptyMessage(t, { loaded, scope, searching: text.trim().length > 0 })}
            />
          }
        />
      </div>

      <section>
        <h3 className={WINDOW_GROUP_LABEL}>{t('settings.memory')}</h3>

        <SettingLine
          title={t('settings.memoryReindex')}
          help={<p className={WINDOW_HELP}>{t('settings.memoryReindexHelp')}</p>}
        >
          <button type="button" className="btn btn-sm" onClick={() => void rebuild()}>
            {t('settings.memoryReindex')}
          </button>
        </SettingLine>

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

        <SettingLine
          title={t('settings.memoryMerge')}
          help={
            <p className={WINDOW_HELP}>
              {duplicates === 0
                ? t('settings.memoryMergeNone')
                : t('settings.memoryMergeFound', { count: duplicates })}
            </p>
          }
        >
          <button
            type="button"
            className="btn btn-sm"
            disabled={duplicates === 0}
            onClick={() => void mergeDuplicates()}
          >
            {t('settings.memoryMerge')}
          </button>
        </SettingLine>

        <SettingLine
          title={t('settings.memoryStale')}
          help={
            <p className={WINDOW_HELP}>
              {sleeping === 0
                ? t('settings.memoryStaleNone')
                : t('settings.memoryStaleFound', { count: sleeping })}
            </p>
          }
        >
          <button
            type="button"
            className="btn btn-sm"
            disabled={sleeping === 0}
            onClick={() => void archiveStale(new Date().toISOString())}
          >
            {t('settings.memoryStale')}
          </button>
        </SettingLine>

        <SettingLine
          title={t('settings.memoryCompact')}
          help={<p className={WINDOW_HELP}>{t('settings.memoryCompactHelp')}</p>}
        >
          <button type="button" className="btn btn-sm" onClick={() => void compact()}>
            {t('settings.memoryCompact')}
          </button>
        </SettingLine>

        <SettingLine
          title={t('settings.memoryPurge')}
          help={<p className={WINDOW_HELP}>{t('settings.memoryPurgeHelp')}</p>}
        >
          <button
            type="button"
            className="btn btn-sm btn-error btn-outline"
            onClick={() => {
              // Asked for plainly: this one erases the file, and no Cancel covers it.
              if (window.confirm(t('settings.memoryPurgeConfirm'))) void reset()
            }}
          >
            {t('settings.memoryPurge')}
          </button>
        </SettingLine>
      </section>
    </div>
  )
}

/** Empty, unmatched, or a studio with no project open — three different things to say. */
function emptyMessage(
  t: (key: string) => string,
  where: { loaded: boolean; scope: MemoryScope; searching: boolean },
): string {
  if (!where.loaded) return t('settings.memoryEmpty')
  if (where.searching) return t('settings.memoryUnmatched')
  return where.scope === 'project' ? t('settings.memoryNoProject') : t('settings.memoryEmpty')
}
