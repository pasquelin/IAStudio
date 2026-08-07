import { app } from 'electron'
import { type Language } from '@shared/i18n'
import { aboutInfo, type AboutInfo } from '@main/about'
import { APP_ICON_PATH } from '@main/resources'

/** The versions are never wanted without the rest, so the pair is composed once, here. */
export function currentAboutInfo(language: Language): AboutInfo {
  return aboutInfo(language, {
    app: app.getVersion(),
    commit: __COMMIT_HASH__,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  })
}

/** Electron renders the panel natively on all three platforms; `iconPath` is Linux and Windows only. */
export function registerAboutPanel(language: Language): void {
  app.setAboutPanelOptions({ ...currentAboutInfo(language), iconPath: APP_ICON_PATH })
}
