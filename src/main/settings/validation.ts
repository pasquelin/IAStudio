import { z } from 'zod'
import { LANGUAGE_PREFERENCES } from '@shared/i18n/languages'
import {
  DENSITIES,
  LOG_VERBOSITIES,
  SETTINGS_SECTION_IDS,
  STARTUP_BEHAVIOURS,
  THEMES,
  type PartialSettings,
  type SettingsSectionId,
} from '@shared/domain/settings'
import {
  boundsOf,
  SETTING_ACTION_IDS,
  type SettingActionId,
} from '@shared/domain/settings-registry'

/** Here rather than in `store.ts`, which imports this module: the type would close a cycle. */
export type Credentials = {
  key: string
  secret: string
}

// Built from the shared unions, never retyped — the same reason `scenario/validation.ts` gives:
// a hand-copied list silently stops accepting what the panel offers.
const scale = boundsOf('appearance.fontScale')

// Six digits, not three and not eight: the value is handed to `--color-accent`, read back by
// `tokenAsHex` for the canvas engines, and that one parses `#rrggbb` alone.
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i)

const appearance = z.object({
  theme: z.enum(THEMES).optional(),
  density: z.enum(DENSITIES).optional(),
  accent: hexColor.optional(),
  // Not `.int()`, unlike the job counts: this one is a slider with a 0.05 step.
  fontScale: z.number().min(scale.min).max(scale.max).optional(),
  reduceMotion: z.boolean().optional(),
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

const general = z.object({
  language: z.enum(LANGUAGE_PREFERENCES).optional(),
  startup: z.enum(STARTUP_BEHAVIOURS).optional(),
})

// Keys are command ids and values signatures, both free strings here: a build that no longer
// knows a command ignores its remap rather than refusing the whole write.
const grid = boundsOf('three.gridSize')
const fly = boundsOf('three.flySpeed')
const boost = boundsOf('three.boostFactor')
const lens = boundsOf('three.fieldOfView')

const three = z.object({
  showGrid: z.boolean().optional(),
  gridSize: z.number().int().min(grid.min).max(grid.max).optional(),
  flySpeed: z.number().min(fly.min).max(fly.max).optional(),
  boostFactor: z.number().min(boost.min).max(boost.max).optional(),
  fieldOfView: z.number().min(lens.min).max(lens.max).optional(),
})

const shortcuts = z.object({
  overrides: z.record(z.string().min(1), z.string().min(1)).optional(),
})

const advanced = z.object({ logLevel: z.enum(LOG_VERBOSITIES).optional() })

const partialSettings = z.object({
  general: general.optional(),
  appearance: appearance.optional(),
  generation: generation.optional(),
  storage: storage.optional(),
  three: three.optional(),
  shortcuts: shortcuts.optional(),
  media: media.optional(),
  advanced: advanced.optional(),
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

// Throws rather than falling back: the id decides which action runs, and a renderer sends it.
const settingAction = z.enum(SETTING_ACTION_IDS)

export function parseSettingAction(value: unknown): SettingActionId {
  return settingAction.parse(value)
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
