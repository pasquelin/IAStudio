import type { FieldDescriptor } from '@shared/domain/model'

/**
 * Narrows the settings the API proposes to what the target model actually declares.
 *
 * The SDK types `Call.parameters` as `unknown`, and these values cross the IPC boundary before
 * filling a form built from `GET /models/{id}`. Filtering here rather than in the renderer keeps
 * the rule testable without mounting anything, and means the renderer never has to doubt what
 * it received.
 *
 * A value the descriptor cannot accept is dropped, never coerced and never clamped: the field
 * then opens on its own default, which is a setting the model published. Inventing a value the
 * API never proposed would be a third opinion nobody asked for.
 */
export function adoptableParameters(
  proposed: unknown,
  fields: readonly FieldDescriptor[],
): Record<string, unknown> {
  if (!isRecord(proposed)) return {}

  const adopted: Record<string, unknown> = {}

  for (const field of fields) {
    if (!(field.key in proposed)) continue

    const value = proposed[field.key]
    if (accepts(field, value)) adopted[field.key] = value
  }

  return adopted
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function withinBounds(field: FieldDescriptor, value: number): boolean {
  if (field.min !== undefined && value < field.min) return false
  return field.max === undefined || value <= field.max
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function accepts(field: FieldDescriptor, value: unknown): boolean {
  switch (field.kind) {
    case 'boolean':
      return typeof value === 'boolean'

    case 'integer':
    case 'seed':
      return isFiniteNumber(value) && Number.isInteger(value) && withinBounds(field, value)

    case 'number':
      return isFiniteNumber(value) && withinBounds(field, value)

    case 'choice':
      if (typeof value !== 'string') return false
      // An empty option list means the model published none; the value is then unverifiable,
      // and a string is the most the descriptor lets us check.
      return !field.options?.length || field.options.some(option => option.value === value)

    case 'text':
    case 'longText':
    case 'color':
    case 'image':
      return typeof value === 'string'

    // Rendered as a plain input — see `DynamicForm`, invariant 5. An object or an array would
    // reach it as `[object Object]`, so only what a text input can hold gets through.
    default:
      return typeof value === 'string' || typeof value === 'boolean' || isFiniteNumber(value)
  }
}
