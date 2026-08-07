import { app } from 'electron'
import { type Language } from '@shared/i18n'
import { aboutInfo, type RuntimeVersions } from '@main/about'
import { APP_ICON_PATH } from '@main/resources'

export function runtimeVersions(): RuntimeVersions {
  return {
    app: app.getVersion(),
    commit: __COMMIT_HASH__,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  }
}

/** Native on macOS and Linux. Windows has no such panel — the menu opens a dialog instead. */
export function registerAboutPanel(language: Language): void {
  app.setAboutPanelOptions({
    ...aboutInfo(language, runtimeVersions()),
    iconPath: APP_ICON_PATH,
  })
}
