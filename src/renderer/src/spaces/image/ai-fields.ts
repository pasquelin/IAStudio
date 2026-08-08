import type { FieldDescriptor } from '@shared/domain/model'
import type { FormValues } from '@/helpers/dynamic-form'

/** What an edit hands a model: the picture it edits, and the region it may repaint. */
export type EditPayload = { image: string; mask?: string }

/**
 * Fills a model's form from an edit, by kind and never by name. Which field takes the picture
 * and which takes the mask is the model's own business — Scenario declares the pairing through
 * `maskFrom`, and reading it is what keeps this free of any one model (invariant 5).
 *
 * Fields it cannot place are left alone: a model that wants something else still opens with its
 * own defaults rather than with a form half-blanked.
 */
export function fillEditFields(
  fields: readonly FieldDescriptor[],
  payload: EditPayload,
): FormValues {
  const values: FormValues = {}

  const maskField = fields.find(field => field.maskFrom !== undefined)
  // The picture the mask masks, when the model says which; otherwise the first image it takes.
  const imageField =
    fields.find(field => field.kind === 'image' && field.key === maskField?.maskFrom) ??
    fields.find(field => field.kind === 'image' && field.key !== maskField?.key)

  if (imageField) values[imageField.key] = payload.image
  if (maskField && payload.mask !== undefined) values[maskField.key] = payload.mask

  return values
}
