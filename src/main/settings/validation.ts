import { z } from 'zod'
import {
  DENSITIES,
  SETTINGS_SECTION_IDS,
  THEMES,
  type PartialSettings,
  type SettingsSectionId,
} from '@shared/domain/settings'
import { boundsOf } from '@shared/domain/settings-registry'
import type { Credentials } from './store'

// Built from the shared unions, never retyped — the same reason `scenario/validation.ts` gives:
// a hand-copied list silently stops accepting what the panel offers.
const appearance = z.object({
  theme: z.enum(THEMES).optional(),
  density: z.enum(DENSITIES).optional(),
})

// Read from the registry, never restated: the bounds a screen offers and the ones this refuses
// are the same numbers, so a ceiling can no longer be lowered on one side alone. The shape,
// however, is still enumerated below — a leaf added to the registry and forgotten here is
// stripped on write rather than validated.
const jobs = boundsOf('generation.concurrentJobs')
const retries = boundsOf('generation.maxRetries')

const generation = z.object({
  concurrentJobs: z.number().int().min(jobs.min).max(jobs.max).optional(),
  maxRetries: z.number().int().min(retries.min).max(retries.max).optional(),
  // Keys are model families and values model ids, both free strings here: the API adds
  // families and models on its own schedule, and an unknown one must not fail the write.
  defaultModels: z.record(z.string().min(1), z.string().min(1)).optional(),
})

const storage = z.object({
  backend: z.enum(['local', 'cloud']).optional(),
  projectsFolder: z.string().min(1).optional(),
  lastProject: z.string().min(1).optional(),
})

// Not checked for existence here: a path typed while the binary is not plugged in yet must be
// storable, and `resolveFfmpeg` falls through to the PATH when it does not resolve.
const media = z.object({ ffmpegPath: z.string().min(1).optional() })

const partialSettings = z.object({
  appearance: appearance.optional(),
  generation: generation.optional(),
  storage: storage.optional(),
  media: media.optional(),
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

// Throws rather than falling back to a default: the section ends up in the URL fragment the
// settings window loads, so anything but a known name is refused outright.
const settingsSection = z.enum(SETTINGS_SECTION_IDS)

export function parseSettingsSection(value: unknown): SettingsSectionId {
  return settingsSection.parse(value)
}

// Trimmed before the length check: a key pasted from a web page carries a trailing newline,
// and the API answers 401 to a credential that only differs by whitespace.
const credential = z.string().trim().min(1)

export function parseCredentials(key: unknown, secret: unknown): Credentials {
  return { key: credential.parse(key), secret: credential.parse(secret) }
}

const storedCredentials = z.object({ key: credential, secret: credential })

/**
 * Reads back what this process wrote, on the same `credential` schema as the input path. A
 * hand-rolled guard accepting `{key:'',secret:''}` made `hasCredentials()` answer true on a
 * blank pair, which `discardUnreadableCredentials` then refused to drop: the dialogue claimed
 * to be configured while every call answered 401.
 */
export function parseStoredCredentials(plain: string): Credentials | null {
  const parsed = storedCredentials.safeParse(JSON.parse(plain))
  return parsed.success ? parsed.data : null
}
