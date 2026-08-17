import type { FieldDescriptor, FieldKind } from '@shared/domain/model'

export type FormValues = Record<string, unknown>

const NUMERIC: readonly FieldKind[] = ['number', 'integer', 'seed']

/**
 * Read by both the schema and the registration. Split in two, the seed field registered as a
 * string and was then validated against a number — a filled seed never passed.
 */
export function isNumeric(kind: FieldKind): boolean {
  return NUMERIC.includes(kind)
}

/** An emptied input is an absent value, not a zero and not an empty string. */
export function blankToUndefined(value: unknown): unknown {
  if (value === '' || value === null) return undefined
  if (typeof value === 'number' && Number.isNaN(value)) return undefined
  return value
}

/** A field whose dependency is unmet is not rendered, and does not take part in the body. */
export function isVisible(field: FieldDescriptor, values: FormValues): boolean {
  if (!field.dependsOn) return true
  return values[field.dependsOn.key] === field.dependsOn.value
}

/** The only keys whose value can change what is on screen. */
export function dependencyKeys(fields: readonly FieldDescriptor[]): string[] {
  return [...new Set(fields.flatMap(field => (field.dependsOn ? [field.dependsOn.key] : [])))]
}

export function visibleFields(
  fields: readonly FieldDescriptor[],
  values: FormValues,
): FieldDescriptor[] {
  return fields.filter(field => isVisible(field, values))
}

export function defaultValues(fields: readonly FieldDescriptor[], preset?: FormValues): FormValues {
  const values: FormValues = {}
  for (const field of fields) {
    // A preset wins over the descriptor's own default, but only for fields the model declares:
    // parameters kept from another model would otherwise reach a form that never had them.
    if (preset && field.key in preset) values[field.key] = preset[field.key]
    else if (field.default !== undefined) values[field.key] = field.default
    else if (field.kind === 'boolean') values[field.key] = false
    else values[field.key] = ''
  }
  return values
}

/**
 * Reduces the form state to the generation body. Hidden and empty fields are dropped rather
 * than sent: the API validates against the model's own schema, and an unexpected `""` on an
 * optional enum is answered with a 400.
 */
export function buildBody(fields: readonly FieldDescriptor[], values: FormValues): FormValues {
  const body: FormValues = {}

  for (const field of visibleFields(fields, values)) {
    const value = blankToUndefined(values[field.key])
    if (value !== undefined) body[field.key] = value
  }

  return body
}

/** Seeds are 32-bit on the API side; anything wider comes back as a different image. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32)
}

/** Groups keep the order the model published them in — it is the order it documents. */
export function groupFields(fields: readonly FieldDescriptor[]): [string, FieldDescriptor[]][] {
  const groups = new Map<string, FieldDescriptor[]>()

  for (const field of fields) {
    const key = field.group ?? ''
    const existing = groups.get(key)
    if (existing) existing.push(field)
    else groups.set(key, [field])
  }

  return [...groups.entries()]
}

/**
 * The reference pictures a filled form carries, in the order the model declared them.
 *
 * Values are handed over as they stand — a local asset id or a data URL — because the field
 * cannot say which one the user gave it. A local id is not one the API has ever heard of: the
 * main process rewrites it on the way out, through the same translator a generation goes
 * through (`main/scenario/asset-inputs.ts`), sending the file if it has never gone up.
 */
export function referencePictures(
  fields: readonly FieldDescriptor[],
  values: FormValues,
): string[] {
  const pictures: string[] = []

  for (const field of fields) {
    if (field.kind !== 'image') continue
    const value = values[field.key]
    if (typeof value === 'string' && value.trim() !== '') pictures.push(value)
  }

  return pictures
}
