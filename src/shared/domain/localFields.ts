import type { FieldDescriptor } from './model'

/**
 * The form a LOCAL model offers, derived rather than declared per model — see
 * `docs/ci/adr/ADR-22-le-formulaire-d-un-modele-local.md`.
 *
 * A Scenario model publishes its own inputs and `ModelRegistry` turns them into
 * `FieldDescriptor[]`; a model on this machine has no server to ask. Writing twenty fields per
 * catalogue entry would be the hand-written form invariant 5 forbids, so the knobs come from the
 * MODALITY — they are the same for every text model, and the same for every diffusion model — and
 * the manifest carries only what it disagrees with.
 */

/** What a runtime takes, as far as a form is concerned. Never a model id, never a runtime name. */
export type LocalModality = 'text' | 'image'

/**
 * One knob, before a language is chosen. `labelKey` rather than `label`: a descriptor field is
 * screen text, and `no-hardcoded-text.test.ts` is right to refuse one written here.
 */
export type LocalFieldTemplate = Omit<FieldDescriptor, 'label' | 'help'> & {
  labelKey: string
  helpKey?: string
}

const PROMPT: LocalFieldTemplate = {
  key: 'prompt',
  kind: 'longText',
  labelKey: 'localFields.prompt',
  required: true,
  promptSpark: true,
}

const SEED: LocalFieldTemplate = {
  key: 'seed',
  kind: 'seed',
  labelKey: 'localFields.seed',
  helpKey: 'localFields.seedHelp',
  required: false,
}

/**
 * What every local model of a modality offers. Bounds are the runtime's, not a model's: a model
 * that wants another default says so in its manifest rather than growing a template of its own.
 */
const TEMPLATES: Record<LocalModality, readonly LocalFieldTemplate[]> = {
  text: [
    PROMPT,
    {
      key: 'temperature',
      kind: 'number',
      labelKey: 'localFields.temperature',
      helpKey: 'localFields.temperatureHelp',
      required: false,
      default: 0.8,
      min: 0,
      max: 2,
      step: 0.05,
    },
    {
      key: 'topP',
      kind: 'number',
      labelKey: 'localFields.topP',
      required: false,
      default: 0.95,
      min: 0,
      max: 1,
      step: 0.05,
      group: 'advanced',
    },
    {
      key: 'maxTokens',
      kind: 'integer',
      labelKey: 'localFields.maxTokens',
      required: false,
      default: 1024,
      min: 16,
      max: 32_768,
      group: 'advanced',
    },
    SEED,
  ],
  image: [
    PROMPT,
    {
      key: 'negativePrompt',
      kind: 'longText',
      labelKey: 'localFields.negativePrompt',
      required: false,
    },
    {
      key: 'width',
      kind: 'integer',
      labelKey: 'localFields.width',
      required: false,
      default: 1024,
      min: 256,
      max: 2048,
      step: 64,
    },
    {
      key: 'height',
      kind: 'integer',
      labelKey: 'localFields.height',
      required: false,
      default: 1024,
      min: 256,
      max: 2048,
      step: 64,
    },
    {
      key: 'steps',
      kind: 'integer',
      labelKey: 'localFields.steps',
      helpKey: 'localFields.stepsHelp',
      required: false,
      default: 20,
      min: 1,
      max: 150,
    },
    {
      key: 'cfgScale',
      kind: 'number',
      labelKey: 'localFields.cfgScale',
      required: false,
      default: 7,
      min: 0,
      max: 30,
      step: 0.5,
      group: 'advanced',
    },
    SEED,
  ],
}

/**
 * What a manifest may disagree with, by field key. Bounds and defaults only — a model never adds
 * a knob its runtime cannot honour, and one that could would be a second runtime.
 */
export type LocalFieldOverrides = Readonly<
  Record<string, Partial<Pick<FieldDescriptor, 'default' | 'min' | 'max' | 'step'>>>
>

/**
 * The form, in the reader's language. `translate` is handed in rather than imported: this runs in
 * the main process, where the language is a service and never a module-level read.
 */
export function localFieldsOf(
  modality: LocalModality,
  overrides: LocalFieldOverrides,
  translate: (key: string) => string,
): FieldDescriptor[] {
  return TEMPLATES[modality].map(({ labelKey, helpKey, ...field }) => ({
    ...field,
    ...overrides[field.key],
    label: translate(labelKey),
    ...(helpKey ? { help: translate(helpKey) } : {}),
  }))
}

/** The keys a bundle has to name, so a guard reads them off the templates rather than a copy. */
export function localFieldKeys(): readonly string[] {
  return Object.values(TEMPLATES)
    .flat()
    .flatMap(field => (field.helpKey ? [field.labelKey, field.helpKey] : [field.labelKey]))
}
