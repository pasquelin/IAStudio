import { z } from 'zod'
import { ASSISTANT_MODELS } from '@shared/domain/assistant'
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
import { boundsOf, SETTING_ACTION_IDS, type SettingActionId } from '@shared/domain/settingsRegistry'
import { ACCOUNT_NAME_MAX_LENGTH } from '@shared/domain/account'
import { DICTATION_MODES } from '@shared/domain/dictation'
import { isSignature } from '@shared/domain/shortcut'
import { HOME_SECTION_IDS } from '@shared/domain/home'
import { RECENT_PROJECTS_MAX } from '@shared/domain/project'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import {
  DISPLAY_UNITS,
  HELPER_VISIBILITIES,
  NORMAL_LENGTH,
  SHADOW_MAP_SIZES,
  SHADOW_QUALITIES,
  VIEWPORT_QUALITIES,
} from '@shared/domain/scene'
import { HEX_COLOR } from '@shared/domain/color'
import type { AccountBook, Credentials } from './accounts'

// Built from the shared unions, never retyped — the same reason `provider/validation.ts` gives:
// a hand-copied list silently stops accepting what the panel offers.
const scale = boundsOf('appearance.fontScale')

// The shape itself is shared with the document readers — the reason it is six digits lives with
// it, and a setting must not accept what a a sky document refuses.
const hexColor = z.string().regex(HEX_COLOR)

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
  // Optional, and it has to stay so: a file written before 13 August carries no such field, and
  // requiring it would fail validation for every entry a user already had.
  createdAt: z.string().min(1).optional(),
})

const storage = z.object({
  backend: z.enum(['local', 'cloud']).optional(),
  projectsFolder: z.string().min(1).optional(),
  lastProject: z.string().min(1).optional(),
  // Bounded here as well as where it is written: the list is session state a hand-edited file
  // could grow without limit, and the home draws every entry it is given.
  recentProjects: z.array(recentProject).max(RECENT_PROJECTS_MAX).optional(),
  // Declared here or dropped in silence: a zod object STRIPS what it does not name, and this
  // branch is reparsed on every settings write — which the project store does on every document
  // saved. The links would survive exactly until the next one.
  projectAccounts: z.record(z.string().min(1), z.string().min(1)).optional(),
})

// Not checked for existence here: a path typed while the binary is not plugged in yet must be
// storable, and `resolveFfmpeg` falls through to the PATH when it does not resolve.
const media = z.object({ ffmpegPath: z.string().min(1).optional() })

const git = z.object({
  binary: z.string().min(1).optional(),
  userName: z.string().min(1).optional(),
  userEmail: z.string().min(1).optional(),
})

const general = z.object({
  language: z.enum(LANGUAGE_PREFERENCES).optional(),
  startup: z.enum(STARTUP_BEHAVIOURS).optional(),
  autosave: z.boolean().optional(),
})

const homeSection = z.object({
  id: z.enum(HOME_SECTION_IDS),
  visible: z.boolean(),
})

/*
 * Caught at the branch as well as at the element, for the reason spelled out under `workspaces`:
 * a section this build no longer knows is dropped rather than made a reason to refuse the whole
 * write, and a `sections` that is not even an array must cost the arrangement and nothing else.
 * `visibleHomeSections` drops the unknown ones a second time, and is the one that has to —
 * nothing guarantees the file went through here.
 */
const home = z
  .object({
    enabled: z.boolean().optional(),
    sections: z
      .array(homeSection.nullable().catch(null))
      .transform(entries => entries.filter(entry => entry !== null))
      .catch([])
      .optional(),
  })
  .catch({})

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
  shadows: z.boolean().optional(),
  shadowQuality: z.enum(SHADOW_QUALITIES).optional(),
  // Read from the shared list, never retyped: what the panel offers and what this refuses have
  // to be the same numbers.
  shadowMapSize: z
    .number()
    .refine(value => SHADOW_MAP_SIZES.includes(value))
    .optional(),
  quality: z.enum(VIEWPORT_QUALITIES).optional(),
  lightHelpers: z.enum(HELPER_VISIBILITIES).optional(),
  cameraHelpers: z.enum(HELPER_VISIBILITIES).optional(),
  boundingBoxes: z.enum(HELPER_VISIBILITIES).optional(),
  origins: z.boolean().optional(),
  normals: z.boolean().optional(),
  normalLength: z.number().min(NORMAL_LENGTH.min).max(NORMAL_LENGTH.max).optional(),
  stats: z.boolean().optional(),
  units: z.enum(DISPLAY_UNITS).optional(),
})

/**
 * Keys are command ids and values signatures. Checked in shape rather than merely non-empty:
 * `Signature` is a string, so `'P'` written where `'KeyP'` was meant arrives here typechecked,
 * and a code is a position while a letter is not — the binding would never fire, with nothing
 * anywhere saying why.
 *
 * One unreadable remap costs its own line and nothing else, as `home.sections` does above: a
 * build that no longer knows a command, or a key bound under an older version, must not take
 * the theme and the projects folder down with it. The whole draft goes through one `safeParse`.
 */
const shortcuts = z.object({
  overrides: z
    .record(z.string().min(1), z.string().refine(isSignature).nullable().catch(null))
    .transform(entries =>
      Object.fromEntries(Object.entries(entries).filter(([, bound]) => bound !== null)),
    )
    .optional(),
})

const advanced = z.object({ logLevel: z.enum(LOG_VERBOSITIES).optional() })

// Enumerated rather than left a string: a model the API does not serve is answered with a 400,
// and the panel that writes this offers a fixed list — so anything else came from a hand-edited
// file, and the defaults are a better answer than a failing assistant.
const assistant = z.object({ model: z.enum(ASSISTANT_MODELS).optional() })

const mcp = z.object({
  enabled: z.boolean().optional(),
  delegateFiles: z.boolean().optional(),
  delegateAsset: z.boolean().optional(),
  delegateRemote: z.boolean().optional(),
  // Bounded here as well as by the field: a budget arrived at through the file rather than through
  // the window is still a budget somebody has to be able to read back.
  delegateBudget: z.number().min(0).max(10_000).optional(),
})

const silence = boundsOf('dictation.silenceMs')
const preview = boundsOf('dictation.previewMs')
const threads = boundsOf('dictation.threads')
const idleUnload = boundsOf('dictation.idleUnloadMinutes')

const dictation = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(DICTATION_MODES).optional(),
  silenceMs: z.number().int().min(silence.min).max(silence.max).optional(),
  previewMs: z.number().int().min(preview.min).max(preview.max).optional(),
  threads: z.number().int().min(threads.min).max(threads.max).optional(),
  idleUnloadMinutes: z.number().int().min(idleUnload.min).max(idleUnload.max).optional(),
  modelFolder: z.string().min(1).optional(),
  // A device id from a machine whose microphones have since changed is stored all the same:
  // the capture falls back to the default rather than refusing to record.
  inputDeviceId: z.string().min(1).optional(),
})

/**
 * A provider, as narrow as the union it mirrors: a `kind` this does not name is dropped rather
 * than stored, so a hand-edited file cannot point a role at something nothing can serve.
 */
const roleProvider = z.union([
  z.object({ kind: z.literal('local'), modelId: z.string().min(1) }),
  z.object({ kind: z.literal('scenario') }),
])

const roleChoices = z.record(z.string().min(1), roleProvider)

// Declared here or dropped in silence, the same trap `storage.projectAccounts` carries: a zod
// object STRIPS what it does not name, and this branch is reparsed on every settings write.
const ai = z.object({
  roles: roleChoices.optional(),
  projectRoles: z.record(z.string().min(1), roleChoices).optional(),
})

const partialSettings = z.object({
  ai: ai.optional(),
  general: general.optional(),
  home: home.optional(),
  workspaces: workspaces.optional(),
  appearance: appearance.optional(),
  generation: generation.optional(),
  storage: storage.optional(),
  three: three.optional(),
  shortcuts: shortcuts.optional(),
  media: media.optional(),
  git: git.optional(),
  advanced: advanced.optional(),
  assistant: assistant.optional(),
  mcp: mcp.optional(),
  dictation: dictation.optional(),
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
