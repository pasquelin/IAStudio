import type { ApiFailure } from './failure'

export type Theme = 'dark' | 'light'
export type Density = 'compact' | 'comfortable'
export type AssetBackend = 'local' | 'cloud'

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
  }
  storage: {
    backend: AssetBackend
    projectsFolder?: string
    lastProject?: string
  }
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: { theme: 'dark', density: 'comfortable' },
  generation: { concurrentJobs: 3, maxRetries: 4 },
  storage: { backend: 'local' },
}

export type PartialSettings = {
  appearance?: Partial<Settings['appearance']>
  generation?: Partial<Settings['generation']>
  storage?: Partial<Settings['storage']>
}

export type AuthState = { authenticated: true } | { authenticated: false; reason: ApiFailure }
