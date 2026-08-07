import { SKYBOX_TAG } from '@shared/domain/model'
import type { FieldDescriptor, FieldKind, ModelFamily } from '@shared/domain/model'

/**
 * Shape of a model input as returned by `GET /models/{id}`. Copied rather than imported from
 * the SDK: this is the boundary with the outside world, and it must survive the day Scenario
 * adds a field we know nothing about.
 */
export type ScenarioInput = {
  name: string
  type: string
  label?: string
  description?: string
  hint?: string
  placeholder?: string
  group?: string
  kind?: string
  color?: boolean
  prompt?: boolean
  default?: unknown
  min?: number
  max?: number
  step?: number
  minLength?: number
  maxLength?: number
  allowedValues?: unknown[]
  required?: { always?: boolean } | null
}

function isInteger(value: number | undefined): boolean {
  return value !== undefined && Number.isInteger(value)
}

function kindOf(input: ScenarioInput): FieldKind {
  if (input.name === 'seed') return 'seed'

  switch (input.type) {
    case 'boolean':
      return 'boolean'
    case 'number':
      // A fractional step (guidance 0.5) means a real number; with no step, integer bounds
      // are enough to decide — otherwise we stay on a real, which accepts integers anyway.
      if (input.step !== undefined) return isInteger(input.step) ? 'integer' : 'number'
      return isInteger(input.min) && isInteger(input.max) ? 'integer' : 'number'
    case 'string':
      if (input.allowedValues?.length) return 'choice'
      if (input.color) return 'color'
      if (input.prompt) return 'longText'
      return 'text'
    case 'file':
      return input.kind === 'image' || input.kind === 'image-hdr' ? 'image' : 'raw'
    default:
      return 'raw'
  }
}

function labelOf(input: ScenarioInput): string {
  if (input.label) return input.label
  // `numInferenceSteps` → `Num inference steps`: an API name stays readable instead of raw.
  const spaced = input.name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function optionsOf(input: ScenarioInput): FieldDescriptor['options'] {
  if (!input.allowedValues?.length) return undefined
  return input.allowedValues.map(value => ({ value: String(value), label: String(value) }))
}

/**
 * Translates a model's inputs into field descriptors. An unknown type falls back to raw
 * input: a model Scenario just added must stay usable, and must never make the form
 * disappear — see spec § 6.
 */
export function translateSchema(inputs: readonly ScenarioInput[] | undefined): FieldDescriptor[] {
  if (!inputs) return []

  return inputs.map(input => {
    const descriptor: FieldDescriptor = {
      key: input.name,
      kind: kindOf(input),
      label: labelOf(input),
      required: input.required?.always === true,
    }

    const help = input.description ?? input.hint ?? input.placeholder
    if (help !== undefined) descriptor.help = help
    if (input.group !== undefined) descriptor.group = input.group
    if (input.default !== undefined) descriptor.default = input.default
    if (input.min !== undefined) descriptor.min = input.min
    if (input.max !== undefined) descriptor.max = input.max
    if (input.step !== undefined) descriptor.step = input.step

    const options = optionsOf(input)
    if (options) descriptor.options = options

    return descriptor
  })
}

const FAMILY_BY_CAPABILITY: readonly { pattern: RegExp; family: ModelFamily }[] = [
  { pattern: /video$/, family: 'video' },
  { pattern: /3d$/, family: '3d' },
  { pattern: /audio$/, family: 'audio' },
  { pattern: /img|inpaint|outpaint|reference|texture/, family: 'image' },
]

/**
 * Infers a model's family from its capabilities. Order matters: `img2video` is a video model,
 * not an image one, and suffixes must win over broader patterns.
 *
 * The tag is consulted first, and only skyboxes need it: a panorama model answers `txt2img`
 * like every other image model, so the capabilities alone would file the whole workspace under
 * Image. See `SKYBOX_TAG` — it is the only signal the API offers.
 */
export function familyOf(
  capabilities: readonly string[] | undefined,
  tags: readonly string[] = [],
): ModelFamily {
  if (tags.includes(SKYBOX_TAG)) return 'skybox'
  if (!capabilities?.length) return 'other'
  for (const { pattern, family } of FAMILY_BY_CAPABILITY) {
    if (capabilities.some(capability => pattern.test(capability))) return family
  }
  return 'other'
}
