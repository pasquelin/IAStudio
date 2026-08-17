import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SETTINGS_SECTION, sectionFromRoute } from '@shared/domain/settings'
import type { SettingPath } from '@shared/domain/settings-path'
import { descriptorsIn, sectionEntry, SETTING_REGISTRY } from '@shared/domain/settings-registry'
import { hitId, matchSettings, sectionsOf, type SearchHit } from '@shared/domain/settings-search'
import { bindingOf } from '@shared/domain/command'
import { useShortcutLabel } from '@/hooks/useShortcutLabel'
import { cn } from '@/helpers/cn'
import { WindowShell } from '@/design/WindowShell'
import { WindowNav } from '@/design/WindowNav/WindowNav'
import { WindowNavItem } from '@/design/WindowNav/WindowNavItem'
import { HINT_RIGHT, HINT_TOP } from '@/helpers/tooltip'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { getBridge } from '@/services/bridge'
import { useAccounts } from '@/stores/accounts'
import { useSettings } from '@/stores/settings'
import { isSettingsDraftDirty, useSettingsDraft } from '@/stores/settings-draft'
import { SettingActions } from './SettingActions'
import { SettingList } from './SettingList'
import { findSection, SETTINGS_SECTIONS, type SettingsSection } from './sections'
import { WINDOW_CAPTION, WINDOW_HELP } from '@/design/window-styles'

/** Whether anything under a section is staged — its own settings, or a sub-section's. */
function sectionIsStaged(touched: ReadonlySet<SettingPath>, section: SettingsSection): boolean {
  const ids = [section.id, ...section.children.map(child => child.id)]
  return SETTING_REGISTRY.some(
    descriptor => touched.has(descriptor.path) && ids.includes(descriptor.section),
  )
}

function NavigationEntry({
  section,
  depth,
  selected,
  onSelect,
}: {
  section: SettingsSection
  depth: number
  selected: string
  onSelect: (id: string) => void
}) {
  const { t } = useTranslation()
  const active = selected === section.id
  // A section is marked when anything under it is staged, sub-sections included: the change
  // would otherwise be invisible from a tree the user has navigated away from.
  const staged = useSettingsDraft(state => sectionIsStaged(state.touched, section))

  return (
    <WindowNavItem
      active={active}
      hint={t(staged ? 'settings.sectionStagedHint' : 'settings.sectionHint')}
      onSelect={() => onSelect(section.id)}
      depth={depth}
      className="gap-1.5 pr-3"
      nested={
        section.children.length > 0 && (
          <ul className="m-0 list-none p-0">
            {section.children.map(child => (
              <NavigationEntry
                key={child.id}
                section={child}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )
      }
    >
      {t(section.labelKey)}
      {staged && (
        <span
          title={t('settings.modified')}
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            active ? 'bg-primary-content' : 'bg-primary',
          )}
        />
      )}
    </WindowNavItem>
  )
}

/**
 * What was found, grouped by the screen it lives on and labelled so a hit can be acted upon
 * without first working out what kind of thing it is.
 *
 * A command is not editable here: it is shown with its key, and the section it belongs to says
 * where to go. Rendering a capture button in a result list would give two places to remap from.
 */
function SearchResults({
  found,
  onGo,
}: {
  found: readonly SearchHit[]
  onGo: (id: string) => void
}) {
  const { t } = useTranslation()

  if (found.length === 0) {
    return <p className={WINDOW_CAPTION}>{t('settings.noResult')}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {sectionsOf(found).map(section => (
        <section key={section}>
          <button
            type="button"
            {...HINT_RIGHT(t('settings.searchSectionHint'))}
            onClick={() => onGo(section)}
            className="text-base-content/70 hover:text-base-content text-tiny mb-1 tracking-wide uppercase"
          >
            {t(sectionEntry(section)?.labelKey ?? '')}
          </button>

          <SettingList
            descriptors={found.flatMap(hit =>
              hit.section === section && hit.kind === 'setting' ? [hit.descriptor] : [],
            )}
          />

          {found
            .filter(hit => hit.section === section && hit.kind !== 'setting')
            .map(hit => (
              <ResultRow key={hitId(hit)} hit={hit} onGo={() => onGo(section)} />
            ))}
        </section>
      ))}
    </div>
  )
}

/** A hit that is not a setting: a button, or a command with the key it answers to. */
function ResultRow({ hit, onGo }: { hit: SearchHit; onGo: () => void }) {
  const { t } = useTranslation()
  const label = useShortcutLabel()
  const overrides = useSettings(state => state.settings.shortcuts.overrides)

  if (hit.kind === 'setting') return null

  const entry = hit.kind === 'action' ? hit.action : hit.command
  const key = hit.kind === 'command' ? label(bindingOf(hit.command.id, overrides)) : ''

  return (
    <button
      type="button"
      {...HINT_RIGHT(t('settings.searchResultHint'))}
      onClick={onGo}
      className="border-base-300 hover:bg-base-300 flex w-full flex-col gap-2 border-b py-3 text-left last:border-b-0"
    >
      <span className="flex items-center justify-between gap-4">
        <span className="text-xs font-medium">{t(entry.titleKey)}</span>
        {key && <span className="shrink-0 font-mono text-xs">{key}</span>}
      </span>
      <span className={WINDOW_HELP}>{t(entry.helpKey)}</span>
    </button>
  )
}

/**
 * The settings window: sections on the left, the selected one on the right. Its own window
 * rather than a panel — settings are not a document, they outlive the workspace being edited,
 * and ⌘, is expected to open one.
 *
 * Nothing is written until Apply or OK: an editing buffer holds the changes, and Cancel drops
 * them. Writing on the spot left no way back from a settings session — the per-row ↺ restores
 * the FACTORY value, not the one held before the window opened.
 */
export function SettingsWindow() {
  const { t } = useTranslation()
  // Opened from a panel rather than from ⌘,: the fragment names the section to land on.
  const [selected, setSelected] = useState<string>(
    () => sectionFromRoute(window.location.hash) ?? DEFAULT_SETTINGS_SECTION,
  )
  const [query, setQuery] = useState('')

  const connect = useSettings(state => state.connect)
  const connectAccounts = useAccounts(state => state.connect)

  // Connected here rather than from the account section: a subscription opened by a leaf is
  // torn down and rebuilt every time the user walks the section tree.
  useEffect(() => {
    const subscriptions = [connect(), connectAccounts()]
    return () => {
      for (const subscription of subscriptions) void subscription.then(stop => stop())
    }
  }, [connect, connectAccounts])

  // Asked for while already open: the window moves instead of reloading, which would throw
  // away a half-typed key. The search is dropped with it — results shown over a section the
  // user was just sent to would hide the very thing a panel asked to show them.
  useEffect(
    () =>
      getBridge()?.settings.onSection(section => {
        setQuery('')
        setSelected(section)
      }),
    [],
  )

  useAppliedSettings()

  // Published so the main process can ask before closing on work nobody applied: closing a
  // window is its decision, and it has no other way to know.
  const pending = useSettingsDraft(isSettingsDraftDirty)
  useEffect(() => {
    void getBridge()?.settings.setPending(pending)
  }, [pending])

  // Searched over the translated title and description, so `t` has to be a dependency: the
  // same query finds different settings once the language changes.
  const found = useMemo(() => matchSettings(query, t), [query, t])

  const section = findSection(selected)
  const searching = query.trim() !== ''

  return (
    <WindowShell
      title={t('settings.title')}
      navLabel={t('settings.sections')}
      footer={<DraftBar />}
      nav={
        <>
          {/*
            Outside the scrolling part, deliberately. Inside it the field was `w-full` of a box
            the scrollbar had already taken its width from, so it narrowed and widened as the
            list grew past the window — and it scrolled away with the sections it filters.
          */}
          <input
            type="search"
            className="input input-xs w-full shrink-0"
            aria-label={t('settings.search')}
            placeholder={t('settings.search')}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />

          <WindowNav>
            {SETTINGS_SECTIONS.map(entry => (
              <NavigationEntry
                key={entry.id}
                section={entry}
                depth={0}
                selected={searching ? '' : selected}
                onSelect={id => {
                  setQuery('')
                  setSelected(id)
                }}
              />
            ))}
          </WindowNav>
        </>
      }
    >
      {searching ? (
        <>
          <h2 className="mb-4 text-base font-semibold">{t('settings.results')}</h2>
          <SearchResults
            found={found}
            onGo={id => {
              setQuery('')
              setSelected(id)
            }}
          />
        </>
      ) : (
        section && (
          <>
            <h2 className="mb-1 text-base font-semibold">{t(section.labelKey)}</h2>
            {section.descriptionKey && (
              <p className={cn(WINDOW_CAPTION, 'mb-4')}>{t(section.descriptionKey)}</p>
            )}
            <SettingList descriptors={descriptorsIn(section.id)} />
            <SettingActions section={section.id} />
            {section.Content && <section.Content />}
          </>
        )
      )}
    </WindowShell>
  )
}

/**
 * Apply, Cancel, OK — and nothing at all while nothing is waiting, so the window is not a form
 * when it has nothing to submit.
 *
 * OK applies and closes; Cancel drops the buffer without writing. Neither exists to be pretty:
 * without them there is no way back from a session of changes, only a per-row return to the
 * factory value.
 */
function DraftBar() {
  const { t } = useTranslation()
  const dirty = useSettingsDraft(isSettingsDraftDirty)
  const apply = useSettingsDraft(state => state.apply)
  const cancel = useSettingsDraft(state => state.cancel)

  if (!dirty) return null

  return (
    <footer className="border-base-300 flex shrink-0 items-center justify-end gap-2 border-t px-4 py-2">
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        {...HINT_TOP(t('settings.cancelHint'))}
        onClick={cancel}
      >
        {t('settings.cancel')}
      </button>
      <button
        type="button"
        className="btn btn-sm"
        {...HINT_TOP(t('settings.applyHint'))}
        onClick={() => void apply()}
      >
        {t('settings.apply')}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-primary"
        {...HINT_TOP(t('settings.confirmHint'))}
        onClick={() => void apply().then(() => window.close())}
      >
        {t('settings.confirm')}
      </button>
    </footer>
  )
}
