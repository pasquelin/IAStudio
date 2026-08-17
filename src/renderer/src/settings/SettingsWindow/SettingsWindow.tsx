import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SETTINGS_SECTION, sectionFromRoute } from '@shared/domain/settings'
import { descriptorsIn } from '@shared/domain/settingsRegistry'
import { matchSettings } from '@shared/domain/settingsSearch'
import { cn } from '@/helpers/cn'
import { WindowShell } from '@/design/WindowShell'
import { WindowNav } from '@/design/WindowNav/WindowNav'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { getBridge } from '@/services/bridge'
import { useAccounts } from '@/stores/accounts'
import { useSettings } from '@/stores/settings'
import { isSettingsDraftDirty, useSettingsDraft } from '@/stores/settingsDraft'
import { SettingActions } from '../SettingActions/SettingActions'
import { SettingList } from '../SettingList'
import { findSection, SETTINGS_SECTIONS } from '../sections'
import { WINDOW_CAPTION } from '@/design/window-styles'
import { SettingsWindowDraftBar } from './SettingsWindowDraftBar'
import { SettingsWindowNavigationEntry } from './SettingsWindowNavigationEntry'
import { SettingsWindowSearchResults } from './SettingsWindowSearchResults'

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
      footer={<SettingsWindowDraftBar />}
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
              <SettingsWindowNavigationEntry
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
          <SettingsWindowSearchResults
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
