import type { ApiFailure } from './failure'
import type { ModelFamily } from './model'

export type Theme = 'dark' | 'light'
export type Density = 'compact' | 'comfortable'
export type AssetBackend = 'local' | 'cloud'

/** The values beside the types: the registry's options and zod both enumerate them from here. */
export const THEMES: readonly Theme[] = ['dark', 'light']
export const DENSITIES: readonly Density[] = ['comfortable', 'compact']

/**
 * Settings the renderer may read. API credentials NEVER appear here: the renderer asks
 * whether it is authenticated, not what the key is — see spec § 9.
 */
export type Settings = {
  appearance: {
    theme: Theme
    density: Density
  }
  generation: {
    concurrentJobs: number
    maxRetries: number
    /** Model preselected by the generator, per family. Absent means "ask every time". */
    defaultModels: Partial<Record<ModelFamily, string>>
  }
  storage: {
    backend: AssetBackend
    projectsFolder?: string
    lastProject?: string
  }
  media: {
    /**
     * An ffmpeg binary to use instead of the one on the PATH. Absent is the normal case: the
     * bundled binary, then the PATH — see `resolveFfmpeg`. Without any of them, importing
     * still works and the interface says what it cannot do.
     */
    ffmpegPath?: string
  }
}

/**
 * The defaults, and the only place they are written: `defaultAt` reads them through a path, so
 * the registry describes settings without restating what they start at. A fresh install is
 * exactly this.
 */
export const DEFAULT_SETTINGS: Settings = {
  appearance: { theme: 'dark', density: 'comfortable' },
  generation: { concurrentJobs: 3, maxRetries: 4, defaultModels: {} },
  storage: { backend: 'local' },
  media: {},
}

/** Derived, so a section added to `Settings` is writable without being restated here. */
export type PartialSettings = { [K in keyof Settings]?: Partial<Settings[K]> }

export type AuthState = { authenticated: true } | { authenticated: false; reason: ApiFailure }

/**
 * Top-level sections of the settings window, named so any surface can ask for one of them —
 * a panel that has just said the API key is missing is expected to lead to where it is typed.
 */
export type SettingsSectionId = 'account' | 'appearance' | 'generation' | 'media'

export const SETTINGS_SECTION_IDS: readonly SettingsSectionId[] = [
  'account',
  'appearance',
  'generation',
  'media',
]

/**
 * The section travels to the settings window inside the URL fragment its renderer reads, so
 * what a renderer sends is checked against the list rather than trusted — see invariant 1.
 */
export function isSettingsSection(value: unknown): value is SettingsSectionId {
  return SETTINGS_SECTION_IDS.some(candidate => candidate === value)
}

/** URL fragment that tells the shared bundle it is rendering the settings window. */
export const SETTINGS_ROUTE = 'settings'

/**
 * The route the settings window loads, section included. Written by the main process and read
 * by the renderer, so both sides live here: a fragment built in one place and parsed in
 * another is a contract nothing checks.
 */
export function settingsRoute(section?: SettingsSectionId): string {
  return section ? `${SETTINGS_ROUTE}/${section}` : SETTINGS_ROUTE
}

export function isSettingsRoute(hash: string): boolean {
  const route = hash.replace(/^#/, '')
  return route === SETTINGS_ROUTE || route.startsWith(`${SETTINGS_ROUTE}/`)
}

/** The section named by the fragment, `null` for a route naming none or naming an unknown. */
export function sectionFromRoute(hash: string): SettingsSectionId | null {
  const section = hash.split('/')[1]
  return isSettingsSection(section) ? section : null
}

/** Where the window opens when nothing names a section — its own ⌘, shortcut included. */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'account'
