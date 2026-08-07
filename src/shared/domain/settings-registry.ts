import { LANGUAGES } from '../i18n/languages'
import {
  DENSITIES,
  LOG_VERBOSITIES,
  STARTUP_BEHAVIOURS,
  THEMES,
  type SettingsSectionId,
} from './settings'
import type { SettingPath, SettingValue, ValueAt } from './settings-path'

/**
 * How a setting is edited. The control follows from the kind alone: no screen decides for
 * itself what a number looks like, so two numeric settings can never end up looking different.
 *
 * Kinds arrive with the first setting that needs one — a branch nothing reaches is a branch
 * nothing tests.
 */
export type SettingKind = 'boolean' | 'choice' | 'color' | 'number' | 'path' | 'slider' | 'text'

/** What a `path` setting points at, and therefore which native picker opens. */
export type PathKind = 'file' | 'folder'

/** The values beside the type, so zod enumerates them from here rather than retyping them. */
export const PATH_KINDS: readonly PathKind[] = ['file', 'folder']

/**
 * A screen of the settings window, and the two texts that name it. Declared here rather than
 * beside the React tree: an id, a label and a description are data, and having the renderer
 * own them left a section able to disagree with the settings it holds.
 *
 * The id is the union `settings.ts` already declares — the one a panel names to open this
 * window on a section, and the one the route is validated against. Two unions for one idea is
 * what this registry exists to prevent.
 */
export type SettingSectionEntry = {
  id: SettingsSectionId
  labelKey: string
  /** Absent on a sub-section, whose parent's description already says what the screen is for. */
  descriptionKey?: string
  /** Set on a sub-section. The navigation builds its tree from this, and nothing else. */
  parent?: SettingsSectionId
}

/**
 * One screen per model family, each holding the default model of that family. Their labels are
 * the workspaces' own: a family and the space that works with it are the same idea to the user.
 *
 * `upscale` has no workspace, so it carries a label of its own.
 */
const MODEL_FAMILY_SECTIONS: readonly SettingSectionEntry[] = [
  { id: 'generation.image', labelKey: 'workspaces.image', parent: 'generation' },
  { id: 'generation.video', labelKey: 'workspaces.video', parent: 'generation' },
  { id: 'generation.3d', labelKey: 'workspaces.3d', parent: 'generation' },
  { id: 'generation.audio', labelKey: 'workspaces.audio', parent: 'generation' },
  { id: 'generation.upscale', labelKey: 'settings.familyUpscale', parent: 'generation' },
]

export const SETTING_SECTIONS: readonly SettingSectionEntry[] = [
  {
    id: 'general',
    labelKey: 'settings.general',
    descriptionKey: 'settings.generalDescription',
  },
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
  ...MODEL_FAMILY_SECTIONS,
  {
    id: 'spaces',
    labelKey: 'settings.spaces',
    descriptionKey: 'settings.spacesDescription',
  },
  {
    id: 'spaces.three',
    labelKey: 'workspaces.3d',
    parent: 'spaces',
  },
  {
    id: 'shortcuts',
    labelKey: 'settings.shortcuts',
    descriptionKey: 'settings.shortcutsDescription',
  },
  {
    id: 'media',
    labelKey: 'settings.media',
    descriptionKey: 'settings.mediaDescription',
  },
  {
    id: 'advanced',
    labelKey: 'settings.advanced',
    descriptionKey: 'settings.advancedDescription',
  },
]

/**
 * Sections of a parent, in declared order. The navigation renders these under it; nothing else
 * decides which screens nest.
 */
export function childSections(parent: SettingsSectionId): readonly SettingSectionEntry[] {
  return SETTING_SECTIONS.filter(section => section.parent === parent)
}

export function rootSections(): readonly SettingSectionEntry[] {
  return SETTING_SECTIONS.filter(section => !section.parent)
}

export function sectionEntry(id: SettingsSectionId): SettingSectionEntry | null {
  return SETTING_SECTIONS.find(section => section.id === id) ?? null
}

export type SettingOption<V extends SettingValue = SettingValue> = {
  value: V
  labelKey?: string
  /**
   * A literal label, for the rare option whose text is the same in every bundle: a language
   * names itself in its own language, so `Français` reads `Français` on an English screen too.
   * Exactly one of the two is set — `settings-registry.test.ts` refuses an option with neither.
   */
  label?: string
}

/** The one place an option's two ways of being named are reconciled. */
export function optionLabel(option: SettingOption, translate: (key: string) => string): string {
  return option.label ?? (option.labelKey ? translate(option.labelKey) : String(option.value))
}

type Descriptor<P extends SettingPath> = {
  path: P
  kind: SettingKind
  section: SettingsSectionId
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
  /**
   * Which native picker a `path` setting opens. Optional on the type and required in practice:
   * `settings-registry.test.ts` refuses a `path` without one, the same way it refuses a numeric
   * setting without bounds. Spelling it in the type would split `Descriptor` into a union and
   * cost every reader a narrowing to get at `min` or `options`.
   */
  pathKind?: PathKind
  /**
   * Greyed out, with the reason shown, while the condition is false. Declarative rather than a
   * predicate: it stays testable, and `shared/` takes on no logic.
   */
  dependsOn?: { path: SettingPath; equals: SettingValue }
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
    path: 'general.language',
    kind: 'choice',
    section: 'general',
    titleKey: 'settings.language.title',
    helpKey: 'settings.language.help',
    // A language names itself in its own language, so those labels are not translated — only
    // `system` is. `LANGUAGES` already carries them; a copy in each bundle would be two.
    options: [
      { value: 'system', labelKey: 'settings.language.system' },
      ...LANGUAGES.map(language => ({ value: language.code, label: language.name })),
    ],
  }),
  setting({
    path: 'general.startup',
    kind: 'choice',
    section: 'general',
    titleKey: 'settings.startup.title',
    helpKey: 'settings.startup.help',
    options: STARTUP_BEHAVIOURS.map(behaviour => ({
      value: behaviour,
      labelKey: `settings.startup.${behaviour}`,
    })),
  }),
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
    path: 'appearance.accent',
    kind: 'color',
    section: 'appearance',
    titleKey: 'settings.accent.title',
    helpKey: 'settings.accent.help',
  }),
  setting({
    path: 'appearance.fontScale',
    kind: 'slider',
    section: 'appearance',
    titleKey: 'settings.fontScale.title',
    helpKey: 'settings.fontScale.help',
    min: 0.85,
    max: 1.4,
    step: 0.05,
  }),
  setting({
    path: 'appearance.reduceMotion',
    kind: 'boolean',
    section: 'appearance',
    titleKey: 'settings.reduceMotion.title',
    helpKey: 'settings.reduceMotion.help',
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
    path: 'three.showGrid',
    kind: 'boolean',
    section: 'spaces.three',
    titleKey: 'settings.showGrid.title',
    helpKey: 'settings.showGrid.help',
  }),
  setting({
    path: 'three.gridSize',
    kind: 'number',
    section: 'spaces.three',
    titleKey: 'settings.gridSize.title',
    helpKey: 'settings.gridSize.help',
    min: 2,
    max: 500,
    dependsOn: { path: 'three.showGrid', equals: true },
  }),
  setting({
    path: 'three.flySpeed',
    kind: 'slider',
    section: 'spaces.three',
    titleKey: 'settings.flySpeed.title',
    helpKey: 'settings.flySpeed.help',
    min: 0.5,
    max: 20,
    step: 0.5,
  }),
  setting({
    path: 'three.boostFactor',
    kind: 'slider',
    section: 'spaces.three',
    titleKey: 'settings.boostFactor.title',
    helpKey: 'settings.boostFactor.help',
    min: 1,
    max: 10,
    step: 0.5,
  }),
  setting({
    path: 'three.fieldOfView',
    kind: 'slider',
    section: 'spaces.three',
    titleKey: 'settings.fieldOfView.title',
    helpKey: 'settings.fieldOfView.help',
    min: 30,
    max: 100,
    step: 5,
  }),
  setting({
    path: 'advanced.logLevel',
    kind: 'choice',
    section: 'advanced',
    titleKey: 'settings.logLevel.title',
    helpKey: 'settings.logLevel.help',
    options: LOG_VERBOSITIES.map(level => ({
      value: level,
      labelKey: `settings.logLevel.${level}`,
    })),
  }),
  setting({
    path: 'media.ffmpegPath',
    kind: 'path',
    pathKind: 'file',
    section: 'media',
    titleKey: 'settings.ffmpegPath.title',
    helpKey: 'settings.ffmpegPath.help',
    placeholderKey: 'settings.ffmpegPath.placeholder',
  }),
]

/**
 * A button, not a setting. It has no path and no value, so forcing it into `Descriptor` would
 * break the coverage check that makes this registry worth having — hence a table of its own,
 * of the same shape: an id, a section, and the two texts that name and explain it.
 */
export type SettingActionId =
  'advanced.openSettingsFile' | 'advanced.openDevtools' | 'advanced.reset'

export type SettingAction = {
  id: SettingActionId
  section: SettingsSectionId
  titleKey: string
  helpKey: string
  buttonKey: string
  /**
   * What is asked before acting. Present exactly where the action cannot be taken back — no
   * Cancel button covers these, since they never pass through the editing buffer.
   */
  confirmKey?: string
}

export const ACTION_REGISTRY: readonly SettingAction[] = [
  {
    id: 'advanced.openSettingsFile',
    section: 'advanced',
    titleKey: 'settings.openSettingsFile.title',
    helpKey: 'settings.openSettingsFile.help',
    buttonKey: 'settings.reveal',
  },
  {
    id: 'advanced.openDevtools',
    section: 'advanced',
    titleKey: 'settings.openDevtools.title',
    helpKey: 'settings.openDevtools.help',
    buttonKey: 'settings.open',
  },
  {
    id: 'advanced.reset',
    section: 'advanced',
    titleKey: 'settings.resetAll.title',
    helpKey: 'settings.resetAll.help',
    buttonKey: 'settings.resetAll.button',
    confirmKey: 'settings.resetAll.confirm',
  },
]

export const SETTING_ACTION_IDS: readonly SettingActionId[] = ACTION_REGISTRY.map(
  action => action.id,
)

export function actionsIn(section: SettingsSectionId): readonly SettingAction[] {
  return ACTION_REGISTRY.filter(action => action.section === section)
}

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

export function descriptorsIn(section: SettingsSectionId): readonly SettingDescriptor[] {
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
