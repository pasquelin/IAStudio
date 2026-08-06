import { useEffect, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useDensity } from '@/hooks/useDensity'
import { useSettings } from '@/stores/settings'
import { AccountSettings } from './AccountSettings'

/** `app-region` is not typed by React; the header is the window's only drag handle. */
const DRAGGABLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties

/**
 * The settings window. Its own window rather than a panel: settings are not a document, they
 * outlive the workspace being edited, and ⌘, is expected to open one.
 *
 * The other tabs of spec § 9 — appearance, generation, storage, shortcuts, performance,
 * advanced — land here as they are built. Only Account exists today.
 */
export function SettingsWindow() {
  const { t } = useTranslation()

  const load = useSettings(state => state.load)
  const density = useSettings(state => state.settings.appearance.density)

  useEffect(() => {
    void load()
  }, [load])

  useDensity(density)

  return (
    <div className="bg-base-200 text-base-content flex h-full flex-col">
      <header
        style={DRAGGABLE}
        className="flex shrink-0 items-center pt-2 pr-4 pb-2 pl-24 text-[13px] font-medium"
      >
        {t('settings.title')}
      </header>

      <main className="flex-1 overflow-auto px-6 pb-6">
        <AccountSettings />
      </main>
    </div>
  )
}
