import { z } from 'zod'
import type { FieldDescriptor } from '@shared/domain/model'
import { blankToUndefined, isNumeric } from './dynamic-form'

/**
 * Apart from `dynamic-form`, which the panels read to shape a body they never validate. Only the
 * form itself validates, and only it is deferred — leaving these three beside their neighbours
 * kept zod's 126,2 kB in the opening chunk, measured 8 August.
 */

function numericSchema(field: FieldDescriptor): z.ZodType {
  let schema = field.kind === 'number' ? z.number() : z.number().int()
  if (field.min !== undefined) schema = schema.min(field.min)
  if (field.max !== undefined) schema = schema.max(field.max)
  return schema
}

function fieldSchema(field: FieldDescriptor): z.ZodType {
  if (field.kind === 'boolean') return z.boolean().optional()

  const base = isNumeric(field.kind) ? numericSchema(field) : z.string().min(1)
  return z.preprocess(blankToUndefined, field.required ? base : base.optional())
}

/**
 * Builds the validation schema from the descriptors the model published. Nothing here is
 * model-specific — that is the whole point: a provider Scenario adds tomorrow gets a
 * validated form without a line of code — see spec § 6.
 */
export function buildSchema(fields: readonly FieldDescriptor[]) {
  const shape: Record<string, z.ZodType> = {}
  for (const field of fields) shape[field.key] = fieldSchema(field)
  return z.object(shape)
}
