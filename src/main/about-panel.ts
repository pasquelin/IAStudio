import { app } from 'electron'
import { type Language } from '@shared/i18n'
import { aboutInfo, type AboutInfo } from '@main/about'
import { APP_ICON_PATH } from '@main/resources'
import { followWindowLanguage, windowLanguage } from '@main/window/language'

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

/** Named at module level so the follower set, which dedupes by identity, holds one of it. */
function register(language: Language): void {
  app.setAboutPanelOptions({ ...currentAboutInfo(language), iconPath: APP_ICON_PATH })
}

/** Electron renders the panel natively on all three platforms; `iconPath` is Linux and Windows only. */
export function registerAboutPanel(): void {
  register(windowLanguage())
  // Set once at startup, so it would keep that language for the whole run. Nothing it shows
  // differs between the two today — the copyright is one line, the same in both — which is
  // precisely why a string added to it later would go unnoticed.
  followWindowLanguage(register)
}
