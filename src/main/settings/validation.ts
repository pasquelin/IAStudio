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
import { ACCOUNT_NAME_MAX_LENGTH } from '@shared/domain/account'
import { isSignature } from '@shared/domain/shortcut'
import { HOME_LIMIT_MAX, HOME_LIMIT_MIN, HOME_SECTION_IDS } from '@shared/domain/home'
import { RECENT_PROJECTS_MAX } from '@shared/domain/project'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import { SHADOW_MAP_SIZES, SHADOW_QUALITIES } from '@shared/domain/scene'
import type { AccountBook, Credentials } from './accounts'

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
  captionArrivals: z.boolean().optional(),
})

const recentProject = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  openedAt: z.string().min(1),
})

const storage = z.object({
  backend: z.enum(['local', 'cloud']).optional(),
  projectsFolder: z.string().min(1).optional(),
  lastProject: z.string().min(1).optional(),
  // Bounded here as well as where it is written: the list is session state a hand-edited file
  // could grow without limit, and the home draws every entry it is given.
  recentProjects: z.array(recentProject).max(RECENT_PROJECTS_MAX).optional(),
})

// Not checked for existence here: a path typed while the binary is not plugged in yet must be
// storable, and `resolveFfmpeg` falls through to the PATH when it does not resolve.
const media = z.object({ ffmpegPath: z.string().min(1).optional() })

const general = z.object({
  language: z.enum(LANGUAGE_PREFERENCES).optional(),
  startup: z.enum(STARTUP_BEHAVIOURS).optional(),
})

const homeSection = z.object({
  id: z.enum(HOME_SECTION_IDS),
  visible: z.boolean(),
  limit: z.number().int().min(HOME_LIMIT_MIN).max(HOME_LIMIT_MAX).optional(),
})

const home = z.object({
  enabled: z.boolean().optional(),
  // A section this build no longer knows is dropped rather than made a reason to refuse the
  // whole write: a user who went back to an earlier version would otherwise lose every other
  // setting along with it. `visibleHomeSections` drops it a second time, and is the one that
  // has to — nothing guarantees the file went through here.
  sections: z
    .array(homeSection.nullable().catch(null))
    .transform(entries => entries.filter(entry => entry !== null))
    .optional(),
})

/*
 * Caught at the branch, not only at the element: a malformed `order` must cost the arrangement
 * and nothing else. Before this branch existed the key was simply stripped, so making it able
 * to send the whole file back to its defaults would be a regression this list introduced.
 *
 * A written order is always a reconciled one, so it can never legitimately outgrow the registry.
 */
const workspaces = z
  .object({
    order: z
      .array(z.enum(WORKSPACE_IDS).nullable().catch(null))
      .max(WORKSPACE_IDS.length)
      .transform(ids => ids.filter(id => id !== null))
      .catch([])
      .optional(),
  })
  .catch({})

// Keys are command ids and values signatures, both free strings here: a build that no longer
// knows a command ignores its remap rather than refusing the whole write.
const grid = boundsOf('three.gridSize')
const fly = boundsOf('three.flySpeed')
const boost = boundsOf('three.boostFactor')
const lens = boundsOf('three.fieldOfView')
const moveStep = boundsOf('three.snapTranslate')
const turnStep = boundsOf('three.snapRotate')
const scaleStep = boundsOf('three.snapScale')

const three = z.object({
  showGrid: z.boolean().optional(),
  gridSize: z.number().int().min(grid.min).max(grid.max).optional(),
  flySpeed: z.number().min(fly.min).max(fly.max).optional(),
  boostFactor: z.number().min(boost.min).max(boost.max).optional(),
  fieldOfView: z.number().min(lens.min).max(lens.max).optional(),
  snapTranslate: z.number().min(moveStep.min).max(moveStep.max).optional(),
  snapRotate: z.number().min(turnStep.min).max(turnStep.max).optional(),
  snapScale: z.number().min(scaleStep.min).max(scaleStep.max).optional(),
  shadowQuality: z.enum(SHADOW_QUALITIES).optional(),
  // Read from the shared list, never retyped: what the panel offers and what this refuses have
  // to be the same numbers.
  shadowMapSize: z
    .number()
    .refine(value => SHADOW_MAP_SIZES.includes(value))
    .optional(),
})

const shortcuts = z.object({
  // Checked in shape, not merely non-empty: `Signature` is a string, so `'P'` written where
  // `'KeyP'` was meant reaches here typechecked, and a code is a position while a letter is not
  // — the binding would simply never fire, with nothing anywhere saying why.
  overrides: z.record(z.string().min(1), z.string().refine(isSignature)).optional(),
})

const advanced = z.object({ logLevel: z.enum(LOG_VERBOSITIES).optional() })

const partialSettings = z.object({
  general: general.optional(),
  home: home.optional(),
  workspaces: workspaces.optional(),
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
 * hand-rolled guard accepting `{key:'',secret:''}` once made `hasCredentials()` answer true on
 * a blank pair: the account screen claimed to be configured while every call answered 401.
 */
export function parseStoredCredentials(plain: string): Credentials | null {
  const parsed = storedCredentials.safeParse(JSON.parse(plain))
  return parsed.success ? parsed.data : null
}

const accountName = z.string().trim().min(1).max(ACCOUNT_NAME_MAX_LENGTH)
const accountId = z.string().trim().min(1)

/**
 * A type guard, not the rule. `checkAccountName` owns what makes a name acceptable, and it
 * answers a code the screen can translate — refusing here instead would surface a name that is
 * merely too long as an unexplained rejected call.
 */
export function parseAccountName(value: unknown): string {
  return z.string().parse(value)
}

/** Throws: the id names what gets written, and a renderer sends it. */
export function parseAccountId(value: unknown): string {
  return accountId.parse(value)
}

const storedAccount = z.object({
  id: accountId,
  name: accountName,
  credentials: storedCredentials,
})

const storedBook = z.object({
  // `catch` per entry rather than on the array: one unreadable account costs its own row, not
  // every key the user holds.
  accounts: z.array(storedAccount.nullable().catch(null)),
  // Caught for the same reason as an entry: a corrupt `activeId` must cost the pointer, not
  // the whole book.
  activeId: z.string().min(1).nullable().catch(null),
})

/**
 * Reads a book back from disk, keeping whatever still parses — and repairing nothing.
 *
 * The repair is `settleBook`, and it runs one step later, inside `withEnvironment`. It has to:
 * the `activeId` on disk may well name the development account, which lives in a file and not
 * in this blob, and repointing it here would send every launch to the wrong key.
 *
 * Null means the blob is not a book at all, which is what tells the caller to look for a lone
 * pair to migrate instead.
 */
export function parseStoredAccounts(plain: string): AccountBook | null {
  const parsed = storedBook.safeParse(JSON.parse(plain))
  if (!parsed.success) return null

  return {
    accounts: parsed.data.accounts.filter(entry => entry !== null),
    activeId: parsed.data.activeId,
  }
}
