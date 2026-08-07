import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { isLicencesRoute } from '@shared/domain/licence'
import { isSettingsRoute } from '@shared/domain/settings'
import { resolveLanguage } from '@shared/i18n'
import { Application } from '@/app/Application'
import { initI18n } from '@/i18n'
import { LicencesWindow } from '@/licences/LicencesWindow'
import { SettingsWindow } from '@/settings/SettingsWindow'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found in index.html')

// Same locale as the native menu, which the main process resolves from `app.getLocale()`:
// an English menu above a French interface reads as a bug.
// The machine's language, for the very first frame: the settings have not been read yet, and
// `useAppliedSettings` corrects it as soon as they land.
await initI18n(resolveLanguage(navigator.language))

/**
 * Every application window loads the same bundle and reads the route from the fragment: the
 * i18n bootstrap, the tokens and the bridge are shared, and navigation is locked, so the
 * fragment is only ever what the main process loaded. The splash is the one exception — it
 * has its own entry precisely so it never pulls this bundle in.
 */
function Route({ hash }: { hash: string }) {
  if (isSettingsRoute(hash)) return <SettingsWindow />
  if (isLicencesRoute(hash)) return <LicencesWindow />
  return <Application />
}

createRoot(root).render(
  <StrictMode>
    <Route hash={window.location.hash} />
  </StrictMode>,
)
