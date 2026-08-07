import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SETTINGS_SECTION, sectionFromRoute } from '@shared/domain/settings'
import type { SettingPath } from '@shared/domain/settings-path'
import {
  descriptorsIn,
  matchSettings,
  sectionEntry,
  SETTING_REGISTRY,
  type SettingDescriptor,
} from '@shared/domain/settings-registry'
import { DRAGGABLE } from '@/helpers/app-region'
import { cn } from '@/helpers/cn'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { getBridge } from '@/services/bridge'
import { useSettings } from '@/stores/settings'
import { isDirty, useSettingsDraft } from '@/stores/settings-draft'
import { SettingActions } from './SettingActions'
import { SettingList } from './SettingList'
import { findSection, SETTINGS_SECTIONS, type SettingsSection } from './sections'

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
    <li>
      <button
        type="button"
        aria-current={active ? 'page' : undefined}
        onClick={() => onSelect(section.id)}
        style={{ paddingLeft: `${0.75 + depth * 1}rem` }}
        className={cn(
          'flex h-(--sc-control) w-full items-center gap-1.5 rounded-(--radius-sc-sm) pr-3 text-left text-xs',
          active ? 'bg-primary text-primary-content' : 'hover:bg-base-300',
        )}
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
      </button>

      {section.children.length > 0 && (
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
      )}
    </li>
  )
}

function SearchResults({ found }: { found: readonly SettingDescriptor[] }) {
  const { t } = useTranslation()

  if (found.length === 0) {
    return <p className="text-base-content/60 text-xs">{t('settings.noResult')}</p>
  }

  const sections = [...new Set(found.map(descriptor => descriptor.section))]

  return (
    <div className="flex flex-col gap-4">
      {sections.map(section => (
        <section key={section}>
          <h3 className="text-base-content/60 mb-1 text-[11px] tracking-wide uppercase">
            {t(sectionEntry(section)?.labelKey ?? '')}
          </h3>
          <SettingList descriptors={found.filter(entry => entry.section === section)} />
        </section>
      ))}
    </div>
  )
}

/**
 * The settings window: sections on the left, the selected one on the right. Its own window
 * rather than a panel — settings are not a document, they outlive the workspace being edited,
 * and ⌘, is expected to open one.
 *
 * Changes are written as they are made rather than behind an Apply button — a text field when
 * it is left, everything else on the spot. Every setting here is reversible and immediately
 * visible, and a buffered form would add a dirty state to reconcile against the other windows
 * already replicating these settings.
 */
export function SettingsWindow() {
  const { t } = useTranslation()
  // Opened from a panel rather than from ⌘,: the fragment names the section to land on.
  const [selected, setSelected] = useState<string>(
    () => sectionFromRoute(window.location.hash) ?? DEFAULT_SETTINGS_SECTION,
  )
  const [query, setQuery] = useState('')

  const connect = useSettings(state => state.connect)

  useEffect(() => {
    const subscription = connect()
    return () => void subscription.then(stop => stop())
  }, [connect])

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

  // Searched over the translated title and description, so `t` has to be a dependency: the
  // same query finds different settings once the language changes.
  const found = useMemo(() => matchSettings(query, t), [query, t])

  const section = findSection(selected)
  const searching = query.trim() !== ''

  return (
    <div className="bg-base-200 text-base-content flex h-full flex-col">
      <header
        style={DRAGGABLE}
        className="flex shrink-0 items-center pt-2 pr-4 pb-2 pl-24 text-[13px] font-medium"
      >
        {t('settings.title')}
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label={t('settings.sections')}
          className="border-base-300 flex w-56 shrink-0 flex-col gap-2 overflow-auto border-r p-2"
        >
          <input
            type="search"
            className="input input-xs w-full"
            aria-label={t('settings.search')}
            placeholder={t('settings.search')}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />

          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
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
          </ul>
        </nav>

        <main className="min-w-0 flex-1 overflow-auto px-6 py-4">
          {searching ? (
            <>
              <h2 className="mb-4 text-base font-semibold">{t('settings.results')}</h2>
              <SearchResults found={found} />
            </>
          ) : (
            section && (
              <>
                <h2 className="mb-1 text-base font-semibold">{t(section.labelKey)}</h2>
                {section.descriptionKey && (
                  <p className="text-base-content/60 mb-4 text-xs">{t(section.descriptionKey)}</p>
                )}
                <SettingList descriptors={descriptorsIn(section.id)} />
                <SettingActions section={section.id} />
                {section.Content && <section.Content />}
              </>
            )
          )}
        </main>
      </div>

      <DraftBar />
    </div>
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
  const dirty = useSettingsDraft(isDirty)
  const apply = useSettingsDraft(state => state.apply)
  const cancel = useSettingsDraft(state => state.cancel)

  if (!dirty) return null

  return (
    <footer className="border-base-300 flex shrink-0 items-center justify-end gap-2 border-t px-4 py-2">
      <button type="button" className="btn btn-sm btn-ghost" onClick={cancel}>
        {t('settings.cancel')}
      </button>
      <button type="button" className="btn btn-sm" onClick={() => void apply()}>
        {t('settings.apply')}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-primary"
        onClick={() => void apply().then(() => window.close())}
      >
        {t('settings.confirm')}
      </button>
    </footer>
  )
}
