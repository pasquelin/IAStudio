import { NAVIGATION_PRESETS } from './navigationPreset'
import { LANGUAGES } from '../i18n/languages'
import { ASSISTANT_STEPS_MAX, ASSISTANT_STEPS_MIN } from './assistantSteps'
import { DICTATION_MODES } from './dictation'
import {
  DENSITIES,
  LOG_VERBOSITIES,
  STARTUP_BEHAVIOURS,
  THEMES,
  type SettingsSectionId,
} from './settings'
import type { ModelFamily } from './model'
import { DISPLAY_UNITS, SHADOW_MAP_SIZES, SHADOW_QUALITIES, VIEWPORT_QUALITIES } from './scene'
import type { SettingActionId } from './settingAction'
import type { SettingPath, SettingValue, ValueAt } from './settingsPath'

// Re-exported so the callers that ask this module for the ids keep working: what moved is where
// they are DECLARED, and only because the registry is too heavy for the opening chunk.
export { SETTING_ACTION_IDS, type SettingActionId } from './settingAction'

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
  /**
   * The model family this screen chooses providers for. Declared rather than read back out of
   * the id: an action that cannot find a model of a family has to open the screen that gives it
   * one, and slicing `'background-removal'` off the id would hand it a string nothing checks.
   */
  family?: ModelFamily
}

/** Where a family's model is chosen, when a screen offers one. */
export function sectionOfFamily(family: ModelFamily): SettingsSectionId | undefined {
  return SETTING_SECTIONS.find(section => section.family === family)?.id
}

/**
 * One screen per family, holding every employment that family has and what serves each.
 *
 * They carry `family:` since ADR-23 removed the per-family default picker: an action that cannot
 * find a model has one place to send the person, and this is it. The last three have no
 * workspace of their own — they are the families the canvas edits reach for.
 */
const AI_FAMILY_SECTIONS: readonly SettingSectionEntry[] = [
  { id: 'ai.image', labelKey: 'workspaces.image', parent: 'ai', family: 'image' },
  { id: 'ai.video', labelKey: 'workspaces.video', parent: 'ai', family: 'video' },
  { id: 'ai.3d', labelKey: 'workspaces.3d', parent: 'ai', family: '3d' },
  { id: 'ai.audio', labelKey: 'workspaces.audio', parent: 'ai', family: 'audio' },
  { id: 'ai.material', labelKey: 'workspaces.materials', parent: 'ai', family: 'material' },
  { id: 'ai.skybox', labelKey: 'workspaces.skyboxes', parent: 'ai', family: 'skybox' },
  { id: 'ai.code', labelKey: 'workspaces.code', parent: 'ai', family: 'code' },
  { id: 'ai.upscale', labelKey: 'families.upscale', parent: 'ai', family: 'upscale' },
  {
    id: 'ai.background-removal',
    labelKey: 'families.background-removal',
    parent: 'ai',
    family: 'background-removal',
  },
  {
    id: 'ai.vectorization',
    labelKey: 'families.vectorization',
    parent: 'ai',
    family: 'vectorization',
  },
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
    parent: 'ai',
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
    id: 'ai',
    labelKey: 'settings.ai',
    descriptionKey: 'settings.aiDescription',
  },
  ...AI_FAMILY_SECTIONS,
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
    id: 'dictation',
    labelKey: 'settings.dictation',
    descriptionKey: 'settings.dictationDescription',
  },
  {
    id: 'media',
    labelKey: 'settings.media',
    descriptionKey: 'settings.mediaDescription',
  },
  {
    id: 'git',
    labelKey: 'settings.git',
    descriptionKey: 'settings.gitDescription',
  },
  {
    id: 'mcp',
    labelKey: 'settings.mcp',
    descriptionKey: 'settings.mcpDescription',
  },
  {
    id: 'memory',
    labelKey: 'settings.memory',
    descriptionKey: 'settings.memoryDescription',
  },
  {
    id: 'memory.graph',
    labelKey: 'settings.memoryGraph',
    descriptionKey: 'settings.memoryGraphDescription',
    parent: 'memory',
  },
  {
    id: 'storage',
    labelKey: 'settings.storage',
    descriptionKey: 'settings.storageDescription',
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
   * Exactly one of the two is set — `settingsRegistry.test.ts` refuses an option with neither.
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
   * use, and `settingsRegistry.test.ts` refuses a key missing from either bundle.
   */
  helpKey: string
  min?: number
  max?: number
  step?: number
  options?: readonly SettingOption<ValueAt<P>>[]
  placeholderKey?: string
  /**
   * Which native picker a `path` setting opens. Optional on the type and required in practice:
   * `settingsRegistry.test.ts` refuses a `path` without one, the same way it refuses a numeric
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
    path: 'general.autosave',
    kind: 'boolean',
    section: 'general',
    titleKey: 'settings.autosave.title',
    helpKey: 'settings.autosave.help',
  }),
  // Beside `startup` rather than in a screen of its own: what shows when the studio opens is
  // one subject. Which sections the home draws, and in which order, is set on the home itself
  // — see `home.sections` in `settingsPath.ts`.
  setting({
    path: 'home.enabled',
    kind: 'boolean',
    section: 'general',
    titleKey: 'settings.home.title',
    helpKey: 'settings.home.help',
  }),
  setting({
    path: 'home.news',
    kind: 'boolean',
    section: 'general',
    titleKey: 'settings.homeNews.title',
    helpKey: 'settings.homeNews.help',
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
    path: 'assistant.steps',
    kind: 'number',
    section: 'general',
    titleKey: 'settings.assistantSteps.title',
    helpKey: 'settings.assistantSteps.help',
    min: ASSISTANT_STEPS_MIN,
    max: ASSISTANT_STEPS_MAX,
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
    path: 'generation.landing',
    kind: 'choice',
    section: 'generation',
    titleKey: 'settings.landing.title',
    helpKey: 'settings.landing.help',
    options: [
      { value: 'ask', labelKey: 'settings.landing.ask' },
      { value: 'document', labelKey: 'settings.landing.document' },
      { value: 'newTab', labelKey: 'settings.landing.newTab' },
    ],
  }),
  setting({
    path: 'generation.captionArrivals',
    kind: 'boolean',
    section: 'generation',
    titleKey: 'settings.captionArrivals.title',
    helpKey: 'settings.captionArrivals.help',
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
    path: 'three.navigationPreset',
    kind: 'choice',
    section: 'spaces.three',
    titleKey: 'settings.navigationPreset.title',
    helpKey: 'settings.navigationPreset.help',
    options: NAVIGATION_PRESETS.map(value => ({
      value,
      labelKey: `settings.navigationPreset.${value}`,
    })),
  }),
  setting({
    path: 'three.orbitAroundSelection',
    kind: 'boolean',
    section: 'spaces.three',
    titleKey: 'settings.orbitAroundSelection.title',
    helpKey: 'settings.orbitAroundSelection.help',
  }),
  setting({
    path: 'three.orbitUnderCursor',
    kind: 'boolean',
    section: 'spaces.three',
    titleKey: 'settings.orbitUnderCursor.title',
    helpKey: 'settings.orbitUnderCursor.help',
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
  // Sliders, not counters: a whole-number field refuses the decimals these are made of — their
  // very defaults, half a metre and a tenth, would be unwritable from the screen.
  setting({
    path: 'three.snapTranslate',
    kind: 'slider',
    section: 'spaces.three',
    titleKey: 'settings.snapTranslate.title',
    helpKey: 'settings.snapTranslate.help',
    // Down to a millimetre: the Environment panel offers the fine steps a small object needs,
    // and a floor of a decimetre here would have the write refused on exactly those.
    min: 0.001,
    max: 10,
    step: 0.1,
  }),
  setting({
    path: 'three.snapRotate',
    kind: 'slider',
    section: 'spaces.three',
    titleKey: 'settings.snapRotate.title',
    helpKey: 'settings.snapRotate.help',
    min: 1,
    max: 90,
    step: 1,
  }),
  setting({
    path: 'three.snapScale',
    kind: 'slider',
    section: 'spaces.three',
    titleKey: 'settings.snapScale.title',
    helpKey: 'settings.snapScale.help',
    min: 0.01,
    max: 1,
    step: 0.05,
  }),
  setting({
    path: 'three.gizmoSize',
    kind: 'slider',
    section: 'spaces.three',
    titleKey: 'settings.gizmoSize.title',
    helpKey: 'settings.gizmoSize.help',
    // Up to twice what the object measures: the cap is a CEILING, and somebody working on a
    // small part wants the handles to stand clear of it rather than hug its outline.
    min: 0.75,
    max: 2,
    step: 0.05,
  }),
  setting({
    path: 'three.snapSurfaceAlign',
    kind: 'boolean',
    section: 'spaces.three',
    titleKey: 'settings.snapSurfaceAlign.title',
    helpKey: 'settings.snapSurfaceAlign.help',
  }),
  setting({
    path: 'three.snapSurfaceOffset',
    kind: 'slider',
    section: 'spaces.three',
    titleKey: 'settings.snapSurfaceOffset.title',
    helpKey: 'settings.snapSurfaceOffset.help',
    min: 0,
    max: 1,
    step: 0.01,
  }),
  setting({
    path: 'three.shadows',
    kind: 'boolean',
    section: 'spaces.three',
    titleKey: 'settings.shadows.title',
    helpKey: 'settings.shadows.help',
  }),
  setting({
    path: 'three.shadowQuality',
    kind: 'choice',
    section: 'spaces.three',
    titleKey: 'settings.shadowQuality.title',
    helpKey: 'settings.shadowQuality.help',
    options: SHADOW_QUALITIES.map(value => ({
      value,
      labelKey: `settings.shadowQuality.${value}`,
    })),
    dependsOn: { path: 'three.shadows', equals: true },
  }),
  setting({
    path: 'three.shadowMapSize',
    kind: 'choice',
    section: 'spaces.three',
    titleKey: 'settings.shadowMapSize.title',
    helpKey: 'settings.shadowMapSize.help',
    // A list rather than a slider: the values in between are not allowed, and a slider would
    // suggest they are.
    options: SHADOW_MAP_SIZES.map(value => ({ value, label: String(value) })),
    dependsOn: { path: 'three.shadows', equals: true },
  }),
  setting({
    path: 'three.quality',
    kind: 'choice',
    section: 'spaces.three',
    titleKey: 'settings.viewportQuality.title',
    helpKey: 'settings.viewportQuality.help',
    options: VIEWPORT_QUALITIES.map(value => ({
      value,
      labelKey: `settings.viewportQuality.${value}`,
    })),
  }),
  setting({
    path: 'three.units',
    kind: 'choice',
    section: 'spaces.three',
    titleKey: 'settings.units.title',
    helpKey: 'settings.units.help',
    options: DISPLAY_UNITS.map(value => ({ value, labelKey: `settings.units.${value}` })),
  }),
  setting({
    path: 'storage.projectsFolder',
    kind: 'path',
    pathKind: 'folder',
    section: 'storage',
    titleKey: 'settings.projectsFolder.title',
    helpKey: 'settings.projectsFolder.help',
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
    path: 'dictation.enabled',
    kind: 'boolean',
    section: 'dictation',
    titleKey: 'settings.dictationEnabled.title',
    helpKey: 'settings.dictationEnabled.help',
  }),
  setting({
    path: 'dictation.mode',
    kind: 'choice',
    section: 'dictation',
    titleKey: 'settings.dictationMode.title',
    helpKey: 'settings.dictationMode.help',
    options: DICTATION_MODES.map(mode => ({
      value: mode,
      labelKey: `settings.dictationMode.${mode}`,
    })),
    dependsOn: { path: 'dictation.enabled', equals: true },
  }),
  setting({
    path: 'dictation.silenceMs',
    kind: 'number',
    section: 'dictation',
    titleKey: 'settings.dictationSilence.title',
    helpKey: 'settings.dictationSilence.help',
    min: 200,
    max: 2000,
    step: 50,
    dependsOn: { path: 'dictation.enabled', equals: true },
  }),
  setting({
    path: 'dictation.previewMs',
    kind: 'number',
    section: 'dictation',
    titleKey: 'settings.dictationPreview.title',
    helpKey: 'settings.dictationPreview.help',
    min: 0,
    max: 2000,
    step: 100,
    dependsOn: { path: 'dictation.enabled', equals: true },
  }),
  setting({
    path: 'dictation.threads',
    kind: 'number',
    section: 'dictation',
    titleKey: 'settings.dictationThreads.title',
    helpKey: 'settings.dictationThreads.help',
    min: 1,
    max: 8,
    dependsOn: { path: 'dictation.enabled', equals: true },
  }),
  setting({
    path: 'dictation.idleUnloadMinutes',
    kind: 'number',
    section: 'dictation',
    titleKey: 'settings.dictationIdleUnload.title',
    helpKey: 'settings.dictationIdleUnload.help',
    min: 0,
    max: 120,
    dependsOn: { path: 'dictation.enabled', equals: true },
  }),
  setting({
    path: 'dictation.modelFolder',
    kind: 'path',
    pathKind: 'folder',
    section: 'dictation',
    titleKey: 'settings.dictationModelFolder.title',
    helpKey: 'settings.dictationModelFolder.help',
    placeholderKey: 'settings.dictationModelFolder.placeholder',
    dependsOn: { path: 'dictation.enabled', equals: true },
  }),
  setting({
    path: 'mcp.enabled',
    kind: 'boolean',
    section: 'mcp',
    titleKey: 'settings.mcpEnabled.title',
    helpKey: 'settings.mcpEnabled.help',
  }),
  /**
   * The delegation, and it lives HERE rather than anywhere a client can reach: `settings.write`
   * refuses this branch outright, so the window is the only way in. All four hang off
   * `mcp.enabled` — arming what a closed door may do is a question nobody asked.
   */
  setting({
    path: 'mcp.delegateFiles',
    kind: 'boolean',
    section: 'mcp',
    titleKey: 'settings.mcpDelegateFiles.title',
    helpKey: 'settings.mcpDelegateFiles.help',
    dependsOn: { path: 'mcp.enabled', equals: true },
  }),
  setting({
    path: 'mcp.delegateAsset',
    kind: 'boolean',
    section: 'mcp',
    titleKey: 'settings.mcpDelegateAsset.title',
    helpKey: 'settings.mcpDelegateAsset.help',
    dependsOn: { path: 'mcp.enabled', equals: true },
  }),
  setting({
    path: 'mcp.delegateRemote',
    kind: 'boolean',
    section: 'mcp',
    titleKey: 'settings.mcpDelegateRemote.title',
    helpKey: 'settings.mcpDelegateRemote.help',
    dependsOn: { path: 'mcp.enabled', equals: true },
  }),
  setting({
    path: 'mcp.delegateBudget',
    kind: 'number',
    min: 0,
    max: 10_000,
    step: 1,
    section: 'mcp',
    titleKey: 'settings.mcpDelegateBudget.title',
    helpKey: 'settings.mcpDelegateBudget.help',
    dependsOn: { path: 'mcp.enabled', equals: true },
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
  setting({
    path: 'git.binary',
    kind: 'path',
    pathKind: 'file',
    section: 'git',
    titleKey: 'settings.gitBinary.title',
    helpKey: 'settings.gitBinary.help',
    placeholderKey: 'settings.gitBinary.placeholder',
  }),
  setting({
    path: 'git.userName',
    kind: 'text',
    section: 'git',
    titleKey: 'settings.gitUserName.title',
    helpKey: 'settings.gitUserName.help',
    placeholderKey: 'settings.gitUserName.placeholder',
  }),
  setting({
    path: 'git.userEmail',
    kind: 'text',
    section: 'git',
    titleKey: 'settings.gitUserEmail.title',
    helpKey: 'settings.gitUserEmail.help',
    placeholderKey: 'settings.gitUserEmail.placeholder',
  }),
]

/**
 * A button, not a setting. It has no path and no value, so forcing it into `Descriptor` would
 * break the coverage check that makes this registry worth having — hence a table of its own,
 * of the same shape: an id, a section, and the two texts that name and explain it.
 */
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
    id: 'advanced.openLogFolder',
    section: 'advanced',
    titleKey: 'settings.openLogFolder.title',
    helpKey: 'settings.openLogFolder.help',
    // Its own label rather than the shared `reveal`: two buttons reading the same words sit in
    // this section, and a reader listing them by name could not tell which reveals what.
    buttonKey: 'settings.openLogFolder.button',
  },
  {
    id: 'advanced.openDevtools',
    section: 'advanced',
    titleKey: 'settings.openDevtools.title',
    helpKey: 'settings.openDevtools.help',
    buttonKey: 'settings.open',
  },
  {
    // The port and the token are minted per launch, so there is nothing to write down and
    // nothing to show on this screen — only a line to paste, which is what this hands over.
    id: 'mcp.copyCommand',
    section: 'mcp',
    titleKey: 'settings.copyMcpCommand.title',
    helpKey: 'settings.copyMcpCommand.help',
    buttonKey: 'settings.copyMcpCommand.button',
  },
  {
    // The same two facts in the shape a client that reads a FILE takes them: one command line
    // covers Claude Code, and nothing covered the others.
    id: 'mcp.copyConfig',
    section: 'mcp',
    titleKey: 'settings.copyMcpConfig.title',
    helpKey: 'settings.copyMcpConfig.help',
    buttonKey: 'settings.copyMcpConfig.button',
  },
  {
    // Asked before acting, and it is the only action here that writes OUTSIDE the studio's own
    // folders: a `.lua` into another application's script folder, on somebody's machine.
    id: 'advanced.installResolveBridge',
    section: 'advanced',
    titleKey: 'settings.installResolveBridge.title',
    helpKey: 'settings.installResolveBridge.help',
    buttonKey: 'settings.installResolveBridge.button',
    confirmKey: 'settings.installResolveBridge.confirm',
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
  // Picked from the microphones actually plugged in, which no table can list ahead of time —
  // `DictationDevices` renders it and `devicechange` keeps it honest.
  'dictation.inputDeviceId',
  // Waits on the cloud backend actually existing: offering a choice nothing implements would
  // be a promise the application cannot keep.
  'storage.backend',
  // Chosen from the assistant's own panel, where the wish to change it arises: one wants a
  // better model mid-sentence, and going through this screen to get there loses the sentence.
  'assistant.model',
  // The working aids of the 3D viewport, for the same reason as the line above: one turns a
  // bounding box on to answer a question about the object in front of them, and a preferences
  // window opened to get there is a window closed before the answer was read. They live in the
  // Environment panel, beside the scene they describe.
  'three.lightHelpers',
  'three.cameraHelpers',
  'three.boundingBoxes',
  'three.origins',
  'three.normals',
  'three.normalLength',
  'three.stats',
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
 * path declares nothing — `settingsRegistry.test.ts` is what guarantees no numeric setting
 * ever reaches that fallback.
 */
export function boundsOf(path: SettingPath): Bounds {
  const descriptor = descriptorAt(path)
  return {
    min: descriptor?.min ?? Number.NEGATIVE_INFINITY,
    max: descriptor?.max ?? Number.POSITIVE_INFINITY,
  }
}
