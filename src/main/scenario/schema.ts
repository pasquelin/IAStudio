import type { FieldDescriptor, FieldKind, ModelFamily } from '@shared/domain/model'

/**
 * Forme d'un input de modèle telle que renvoyée par `GET /models/{id}`. Recopiée plutôt
 * qu'importée du SDK : c'est la frontière avec l'extérieur, et elle doit survivre au
 * jour où Scenario ajoute un champ qu'on ne connaît pas.
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
      // Un pas fractionnaire (guidance 0.5) est un réel ; sans pas, des bornes entières
      // suffisent à trancher — sinon on reste sur un réel, qui accepte les entiers.
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
  // `numInferenceSteps` → `Num inference steps` : un nom d'API reste lisible plutôt que brut.
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
 * Traduit les inputs d'un modèle en descripteurs de champs. Un type inconnu retombe en
 * saisie brute : un modèle que Scenario vient d'ajouter doit rester utilisable, jamais
 * faire disparaître le formulaire — cf. spec § 6.
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
 * Déduit la famille d'un modèle de ses capacités. L'ordre compte : `img2video` est un
 * modèle vidéo, pas un modèle image, et les suffixes tranchent avant les motifs larges.
 */
export function familyOf(capabilities: readonly string[] | undefined): ModelFamily {
  if (!capabilities?.length) return 'other'
  for (const { pattern, family } of FAMILY_BY_CAPABILITY) {
    if (capabilities.some(capability => pattern.test(capability))) return family
  }
  return 'other'
}
