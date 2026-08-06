import { z } from 'zod'
import type { PartialSettings } from '@shared/domain/settings'

const appearance = z.object({
  theme: z.enum(['dark', 'light']).optional(),
  density: z.enum(['compact', 'comfortable']).optional(),
})

// Upper bounds are not cosmetic: `concurrentJobs` sizes the JobManager semaphore, and the
// renderer is the one asking.
const generation = z.object({
  concurrentJobs: z.number().int().min(1).max(16).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
})

const storage = z.object({
  backend: z.enum(['local', 'cloud']).optional(),
  projectsFolder: z.string().min(1).optional(),
  lastProject: z.string().min(1).optional(),
})

const partialSettings = z.object({
  appearance: appearance.optional(),
  generation: generation.optional(),
  storage: storage.optional(),
})

/** Validates what the renderer sends. Throws: an out-of-bounds write must not be persisted. */
export function parsePartialSettings(value: unknown): PartialSettings {
  return partialSettings.parse(value)
}

/**
 * Validates what the config file holds. A hand-edited or corrupted file falls back to the
 * defaults rather than propagating `theme: 'purple'` into the whole interface.
 */
export function salvagePartialSettings(value: unknown): PartialSettings {
  const parsed = partialSettings.safeParse(value)
  return parsed.success ? parsed.data : {}
}
