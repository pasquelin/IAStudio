import type { LanguagePreference } from '../i18n/languages'
import type { BindingOverrides } from './command'
import type { ApiFailure } from './failure'
import type { ModelFamily } from './model'
import type { ShadowQuality } from './scene'

/**
 * Spelled exactly as Electron's `nativeTheme.themeSource`, which takes these three words: the
 * main process assigns the setting straight across, with no table in between to fall behind.
 */
export type Theme = 'dark' | 'light' | 'system'

/** What `system` resolves to. The attribute on the root element carries one of these two. */
export type ResolvedTheme = 'dark' | 'light'

export type Density = 'compact' | 'comfortable'
export type AssetBackend = 'local' | 'cloud'

/**
 * How much the log says, from nothing to everything. Ordered from quietest to loudest, which is
 * what lets a threshold be a simple comparison rather than a table.
 */
export type LogVerbosity = 'silent' | 'error' | 'warn' | 'info'

export const LOG_VERBOSITIES: readonly LogVerbosity[] = ['silent', 'error', 'warn', 'info']

/** What happens when the application opens with no file to show. */
export type StartupBehaviour = 'lastProject' | 'nothing'

export const STARTUP_BEHAVIOURS: readonly StartupBehaviour[] = ['lastProject', 'nothing']

/** The values beside the types: the registry's options and zod both enumerate them from here. */
export const THEMES: readonly Theme[] = ['dark', 'light', 'system']
export const DENSITIES: readonly Density[] = ['comfortable', 'compact']

/**
 * The daisyUI theme names, which are also what `data-theme` carries: daisyUI selects a theme by
 * matching that attribute against the name declared in `index.css`. Written once here so the
 * stylesheet, the renderer that publishes the attribute and the tests all read the same word.
 */
export const THEME_ATTRIBUTE: Record<ResolvedTheme, string> = {
  dark: 'scenario-dark',
  light: 'scenario-light',
}

/**
 * Settings the renderer may read. API credentials NEVER appear here: the renderer asks
 * whether it is authenticated, not what the key is — see spec § 9.
 */
export type Settings = {
  general: {
    language: LanguagePreference
    startup: StartupBehaviour
  }
  appearance: {
    theme: Theme
    density: Density
    /** Overrides `--color-accent`. The theme's own accent when left unset. */
    accent?: string
    /** Multiplies the interface's base size. 1 is what the design was drawn at. */
    fontScale: number
    reduceMotion: boolean
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
  /**
   * The 3D workspace. A branch of its own rather than nested under a `spaces` one: every branch
   * of `Settings` is one level deep, which is what lets the store merge a write by spreading —
   * a nested branch would be replaced wholesale by a write touching one of its leaves.
   */
  three: {
    showGrid: boolean
    /** Extent of the ground grid, in metres. */
    gridSize: number
    /** Metres per second while flying the viewport camera. */
    flySpeed: number
    /** What holding the boost key multiplies the fly speed by. */
    boostFactor: number
    /** Vertical field of view, in degrees. */
    fieldOfView: number
    /**
     * The steps snapping moves by, when it is on. Whether it is on is a session thing — the
     * toolbar toggles it per document — but how coarse it is belongs to the person, not to the
     * moment. Nothing here is applied while snapping is off.
     */
    snapTranslate: number
    /** In degrees, like the inspector: radians are stored, never typed. */
    snapRotate: number
    snapScale: number
    /** How soft a shadow edge is. Which objects throw one is a property of the node. */
    shadowQuality: ShadowQuality
    /** Side of the square map each casting light allocates. Doubling it costs four times as much. */
    shadowMapSize: number
  }
  shortcuts: {
    /**
     * Only the commands the user actually remapped. A command added by a new version arrives
     * with its own default and needs no migration; a remap of one since removed is ignored.
     */
    overrides: BindingOverrides
  }
  advanced: {
    /** How much the log says. `silent` keeps the terminal clean; `debug` keeps everything. */
    logLevel: LogVerbosity
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
  general: { language: 'system', startup: 'lastProject' },
  appearance: { theme: 'dark', density: 'comfortable', fontScale: 1, reduceMotion: false },
  generation: { concurrentJobs: 3, maxRetries: 4, defaultModels: {} },
  three: {
    showGrid: true,
    gridSize: 20,
    flySpeed: 4,
    boostFactor: 3,
    fieldOfView: 60,
    snapTranslate: 0.5,
    snapRotate: 15,
    snapScale: 0.1,
    shadowQuality: 'soft',
    shadowMapSize: 2048,
  },
  storage: { backend: 'local' },
  shortcuts: { overrides: {} },
  advanced: { logLevel: 'info' },
  media: {},
}

/** Derived, so a section added to `Settings` is writable without being restated here. */
export type PartialSettings = { [K in keyof Settings]?: Partial<Settings[K]> }

/**
 * The branches, read off the defaults rather than listed: a section added to `Settings` shows
 * up here on its own, which is what `mergePartial` needs in order not to drop it.
 */
const BRANCHES: readonly (keyof Settings)[] = Object.keys(DEFAULT_SETTINGS).filter(
  (key): key is keyof Settings => key in DEFAULT_SETTINGS,
)

/**
 * Accumulates one write onto another, one branch deep — which is the whole depth of `Settings`.
 *
 * Not the same thing as the store's `merge`, which completes a partial onto a full `Settings`
 * and therefore has the compiler check that no branch is missing. This one accumulates two
 * partials, where an absent branch is normal: it is what an editing buffer is made of.
 */
export function mergePartial(base: PartialSettings, next: PartialSettings): PartialSettings {
  const merged: PartialSettings = { ...base }

  for (const branch of BRANCHES) {
    if (next[branch]) merged[branch] = { ...base[branch], ...next[branch] }
  }

  return merged
}

export type AuthState =
  | {
      authenticated: true
      /**
       * The project this key opens onto, once the library has named it — there is no endpoint
       * that would simply say, so it is learned from the first assets that come back.
       *
       * Absent means "not known yet", which every reader treats as "do not judge ownership"
       * rather than as a mismatch.
       */
      ownerId?: string
    }
  | { authenticated: false; reason: ApiFailure }

/**
 * Sections of the settings window, named so any surface can ask for one of them — a panel that
 * has just said the API key is missing is expected to lead to where it is typed.
 *
 * Sub-sections are part of the union rather than made up by the screen: an id the shared type
 * does not know is refused by the IPC, so `settings.open('generation.image')` would fail on a
 * name the navigation happily displayed.
 */
export type SettingsSectionId =
  | 'general'
  | 'account'
  | 'appearance'
  | 'generation'
  | 'generation.image'
  | 'generation.video'
  | 'generation.3d'
  | 'generation.audio'
  | 'generation.upscale'
  | 'spaces'
  | 'spaces.three'
  | 'shortcuts'
  | 'media'
  | 'storage'
  | 'advanced'

export const SETTINGS_SECTION_IDS: readonly SettingsSectionId[] = [
  'general',
  'account',
  'appearance',
  'generation',
  'generation.image',
  'generation.video',
  'generation.3d',
  'generation.audio',
  'generation.upscale',
  'spaces',
  'spaces.three',
  'shortcuts',
  'media',
  'storage',
  'advanced',
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

/**
 * Where the window opens when nothing names a section — its own ⌘, shortcut included. The top
 * of the list, which is what a settings window is expected to do; a panel that needs the API
 * key names `account` itself.
 */
export const DEFAULT_SETTINGS_SECTION: SettingsSectionId = 'general'
