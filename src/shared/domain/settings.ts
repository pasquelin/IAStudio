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
