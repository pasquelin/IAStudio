import type { AssetType } from '@shared/domain/asset'
import type { FieldDescriptor, FieldKind } from '@shared/domain/model'
import type { FormValues } from '@/helpers/dynamicForm'

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

/**
 * The field kind an asset of this type goes into. `raw` for what a model takes as a plain file —
 * `translateSchema` files a video or a take there, having no kind of its own for them.
 */
const FIELD_KIND: Record<AssetType, FieldKind> = {
  image: 'image',
  texture: 'image',
  skybox: 'image',
  mesh: 'mesh',
  animation: 'mesh',
  video: 'raw',
  audio: 'raw',
}

/** One thing the workspace offers, reduced to what placing it needs. */
export type PlaceableInput = { role: 'source' | 'mask'; kind: AssetType; assetId: string }

/**
 * Fills a model's form from what the workspace holds, by KIND and never by name — the rule
 * `fillEditFields` already follows, widened to every kind an input can carry.
 *
 * 🛑 Fields it cannot place are left alone: a source shown in the panel and dropped here would be
 * exactly the silent generation the panel exists to prevent, so the caller checks what came back.
 */
export function fillSourceFields(
  fields: readonly FieldDescriptor[],
  inputs: readonly PlaceableInput[],
): FormValues {
  const values: FormValues = {}
  const maskField = fields.find(field => field.maskFrom !== undefined)
  const taken = new Set<string>()

  for (const input of inputs) {
    const wanted = FIELD_KIND[input.kind]
    const field =
      input.role === 'mask'
        ? maskField
        : fields.find(
            one => one.kind === wanted && one.key !== maskField?.key && !taken.has(one.key),
          )

    if (!field || taken.has(field.key)) continue
    taken.add(field.key)
    values[field.key] = input.assetId
  }

  return values
}
