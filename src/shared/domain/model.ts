/**
 * A Scenario model's inputs are specific to each model and are discovered at runtime
 * (`GET /models/{id}`). `FieldDescriptor` is their normalized shape, the only one the
 * renderer ever sees — see spec § 6.
 */
export type FieldKind =
  | 'text'
  | 'longText'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'choice'
  | 'image'
  | 'color'
  | 'seed'
  | 'raw'

export type FieldOption = {
  value: string
  label: string
}

export type FieldDescriptor = {
  key: string
  kind: FieldKind
  label: string
  help?: string
  required: boolean
  default?: unknown
  min?: number
  max?: number
  step?: number
  options?: FieldOption[]
  group?: string
  dependsOn?: { key: string; value: unknown }
}

export type ModelFamily =
  'image' | 'video' | '3d' | 'audio' | 'upscale' | 'background-removal' | 'vectorization' | 'other'

export type ModelSummary = {
  id: string
  name: string
  family: ModelFamily
  provider: string
  thumbnail?: string
}

export type ModelDescriptor = ModelSummary & {
  fields: FieldDescriptor[]
}
