import { DENSITIES, THEMES } from './settings'
import type { SettingPath, SettingValue, ValueAt } from './settings-path'

/**
 * How a setting is edited. The control follows from the kind alone: no screen decides for
 * itself what a number looks like, so two numeric settings can never end up looking different.
 *
 * Kinds arrive with the first setting that needs one — a branch nothing reaches is a branch
 * nothing tests.
 */
export type SettingKind = 'choice' | 'number' | 'text'

export type SettingSectionId = 'account' | 'appearance' | 'generation' | 'media'

/**
 * A screen of the settings window, and the two texts that name it. Declared here rather than
 * beside the React tree: an id, a label and a description are data, and having the renderer
 * own them left a section able to disagree with the settings it holds.
 */
export type SettingSectionEntry = {
  id: SettingSectionId
  labelKey: string
  descriptionKey: string
}

export const SETTING_SECTIONS: readonly SettingSectionEntry[] = [
  {
    id: 'account',
    labelKey: 'settings.account',
    descriptionKey: 'settings.accountDescription',
  },
  {
    id: 'appearance',
    labelKey: 'settings.appearance',
    descriptionKey: 'settings.appearanceDescription',
  },
  {
    id: 'generation',
    labelKey: 'settings.generation',
    descriptionKey: 'settings.generationDescription',
  },
  {
    id: 'media',
    labelKey: 'settings.media',
    descriptionKey: 'settings.mediaDescription',
  },
]

export function sectionEntry(id: SettingSectionId): SettingSectionEntry | null {
  return SETTING_SECTIONS.find(section => section.id === id) ?? null
}

export type SettingOption<V extends SettingValue = SettingValue> = {
  value: V
  labelKey: string
}

type Descriptor<P extends SettingPath> = {
  path: P
  kind: SettingKind
  section: SettingSectionId
  titleKey: string
  /**
   * Never optional. A setting whose effect cannot be stated in a sentence is one nobody can
   * use, and `settings-registry.test.ts` refuses a key missing from either bundle.
   */
  helpKey: string
  min?: number
  max?: number
  step?: number
  options?: readonly SettingOption<ValueAt<P>>[]
  placeholderKey?: string
}

/**
 * The union over every path, so `options` is checked against what the path actually holds:
 * offering `'purple'` as a theme stops compiling here rather than being refused by the IPC.
 */
export type SettingDescriptor = { [P in SettingPath]: Descriptor<P> }[SettingPath]

/**
 * Identity, but generic over the path: it is what keeps `'appearance.theme'` a literal through
 * inference instead of widening to `string`, which is what lets the coverage check see which
 * settings the registry actually describes.
 */
function setting<P extends SettingPath>(descriptor: Descriptor<P>): Descriptor<P> {
  return descriptor
}

/**
 * What every setting is: its control, its bounds, and the two texts that name and explain it.
 * The screens read this, and so does the validation — bounds written here are the ones the
 * main process enforces, which is what keeps a panel from proposing a value the IPC rejects.
 *
 * Defaults are NOT repeated here: `DEFAULT_SETTINGS` holds them, and `defaultAt` reads them
 * through the path.
 */
export const SETTING_REGISTRY = [
  setting({
    path: 'appearance.theme',
    kind: 'choice',
    section: 'appearance',
    titleKey: 'settings.theme.title',
    helpKey: 'settings.theme.help',
    // Built from the shared union rather than retyped: one list of themes, read by the screen
    // and by zod alike.
    options: THEMES.map(theme => ({ value: theme, labelKey: `settings.theme.${theme}` })),
  }),
  setting({
    path: 'appearance.density',
    kind: 'choice',
    section: 'appearance',
    titleKey: 'settings.density.title',
    helpKey: 'settings.density.help',
    options: DENSITIES.map(density => ({
      value: density,
      labelKey: `settings.density.${density}`,
    })),
  }),
  setting({
    path: 'generation.concurrentJobs',
    kind: 'number',
    section: 'generation',
    titleKey: 'settings.concurrentJobs.title',
    helpKey: 'settings.concurrentJobs.help',
    min: 1,
    max: 16,
  }),
  setting({
    path: 'generation.maxRetries',
    kind: 'number',
    section: 'generation',
    titleKey: 'settings.maxRetries.title',
    helpKey: 'settings.maxRetries.help',
    min: 0,
    max: 10,
  }),
  setting({
    path: 'media.ffmpegPath',
    kind: 'text',
    section: 'media',
    titleKey: 'settings.ffmpegPath.title',
    helpKey: 'settings.ffmpegPath.help',
    placeholderKey: 'settings.ffmpegPath.placeholder',
  }),
]

/** Same trick as `setting`, for a plain list of paths. */
function paths<P extends SettingPath[]>(...list: P): P {
  return list
}

/**
 * Leaves of `Settings` no control edits, and why. Written down so the coverage check can tell
 * a deliberate omission from a setting someone forgot to describe.
 */
export const UNLISTED_PATHS = paths(
  // Written by the main process every time a project opens: session state, not a preference.
  'storage.lastProject',
  // Both belong to the Storage screen, which waits on the cloud backend actually existing —
  // offering a backend nothing implements would be a promise the app cannot keep.
  'storage.backend',
  'storage.projectsFolder',
)

/**
 * Every leaf of `Settings` is either described above or listed as unlisted. A setting added to
 * the type and forgotten in both makes this collapse to something other than `never`, and the
 * alias below stops compiling — the gap surfaces at build time, not on an empty screen.
 */
type Accounted<T extends never> = T

export type UnaccountedPath = Accounted<
  Exclude<SettingPath, (typeof SETTING_REGISTRY)[number]['path'] | (typeof UNLISTED_PATHS)[number]>
>

export function descriptorAt(path: SettingPath): SettingDescriptor | null {
  return SETTING_REGISTRY.find(descriptor => descriptor.path === path) ?? null
}

export function descriptorsIn(section: SettingSectionId): readonly SettingDescriptor[] {
  return SETTING_REGISTRY.filter(descriptor => descriptor.section === section)
}

/**
 * Widens the options of one descriptor. The registry types them per path, which makes the
 * union non-iterable at a call site; this is the single place that flattening happens.
 */
export function optionsOf(descriptor: SettingDescriptor): readonly SettingOption[] {
  return descriptor.options ?? []
}

export type Bounds = {
  min: number
  max: number
}

/**
 * Bounds a numeric setting declares, for zod as much as for the control. Unbounded when the
 * path declares nothing — `settings-registry.test.ts` is what guarantees no numeric setting
 * ever reaches that fallback.
 */
export function boundsOf(path: SettingPath): Bounds {
  const descriptor = descriptorAt(path)
  return {
    min: descriptor?.min ?? Number.NEGATIVE_INFINITY,
    max: descriptor?.max ?? Number.POSITIVE_INFINITY,
  }
}

/**
 * Accents dropped and case folded, so "thème" is found by typing `theme` — a search box that
 * demands a circumflex is a search box nobody uses.
 */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Settings matching what was typed, searched over what is on screen — title and description —
 * rather than over paths, which the user never sees. `translate` is injected because `shared/`
 * carries no i18n runtime.
 */
export function matchSettings(
  query: string,
  translate: (key: string) => string,
): readonly SettingDescriptor[] {
  const needle = fold(query.trim())
  if (needle === '') return []

  return SETTING_REGISTRY.filter(descriptor =>
    fold(`${translate(descriptor.titleKey)} ${translate(descriptor.helpKey)}`).includes(needle),
  )
}
