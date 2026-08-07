import { APP_NAME } from '@shared/constants'
import { TRANSLATIONS, type Language } from '@shared/i18n'

/**
 * What is running. Injected so the shape stays testable.
 *
 * `electron`, `chrome` and `node` are collected but deliberately not shown — the panel names
 * the product, not its plumbing. They stay here so surfacing them again is a one-line change.
 */
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
}

/**
 * `applicationVersion` carries the release and `version` the build. Electron only renders
 * `version` on macOS, so elsewhere the commit reaches no one — accepted, not overlooked.
 */
export function aboutInfo(language: Language, versions: RuntimeVersions): AboutInfo {
  return {
    applicationName: APP_NAME,
    applicationVersion: versions.app,
    version: versions.commit,
    copyright: TRANSLATIONS[language].about.copyright,
  }
}
