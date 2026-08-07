import { APP_NAME } from '@shared/constants'
import { TRANSLATIONS, type Language } from '@shared/i18n'

/** Everything the panel says about what is running. Injected so the shape stays testable. */
export type RuntimeVersions = {
  app: string
  commit: string
  electron: string
  chrome: string
  node: string
}

export type AboutInfo = {
  applicationName: string
  applicationVersion: string
  version: string
  copyright: string
  credits: string
}

/**
 * `applicationVersion` carries the release and `version` the build — the split the native
 * panel expects, and the one that lets a bug report name the exact commit.
 *
 * Imports no Electron: a module that does cannot be tested under plain Node, which is where
 * the main process suites run. The wiring lives in `about-panel.ts`.
 */
export function aboutInfo(language: Language, versions: RuntimeVersions): AboutInfo {
  return {
    applicationName: APP_NAME,
    applicationVersion: versions.app,
    version: versions.commit,
    copyright: TRANSLATIONS[language].about.copyright,
    credits: `Electron ${versions.electron} · Chromium ${versions.chrome} · Node ${versions.node}`,
  }
}
