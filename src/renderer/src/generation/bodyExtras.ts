import STUDIO_TYPES from '@game/api/studio.d.ts?raw'
import { reworksItsOutput } from '@shared/domain/aiCapability'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import type { FieldDescriptor, ModelFamily } from '@shared/domain/model'
import { withPixelArtPrompt } from '@shared/domain/pixelArtPrompt'
// 🛑 By `promptSpark` and never by the field's NAME: guessing by name is how a sentence lands
// in the NEGATIVE prompt, asking a model for the opposite of what was wanted.
import { promptKeyOf } from '@shared/domain/projectContext'
import { gridOf } from '@/engines/canvas/pixelGrid'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { CODE_API_FIELD, CODE_SOURCE_FIELD } from '@shared/domain/codeGeneration'
import type { FormValues } from '@/helpers/dynamicForm'
import { codeFileOf } from '@/stores/code'
import { activeImageId, activeScriptId, useDocuments } from '@/stores/documents'

/**
 * What a family adds beyond the form — what the WORKSPACE holds and no model schema publishes.
 *
 * A table rather than a branch in the panel, which serves every family and knows none:
 * `Record<ModelFamily, …>` makes the compiler ask for the line of the family that arrives.
 */
/** The grid of the image in front — `null` when no image is there, or it is not on one. */
export function gridInFront(): { columns: number; rows: number } | null {
  const documentId = activeImageId(useDocuments.getState())
  return documentId === null ? null : gridOf(canvasOf(useCanvases.getState(), documentId))
}

type Extra = (
  role: AiRoleId,
  values: FormValues,
  fields: readonly FieldDescriptor[],
  pixelArt: boolean,
) => FormValues

const EXTRAS: Record<ModelFamily, Extra | null> = {
  /**
   * The studio's own grid, which no model schema publishes. Written HERE and not in the main:
   * `promptContext` runs a process away from the store that holds the grid, and the renderer
   * writes before it — so the order comes out subject, then style, then world, which is what a
   * model truncates from the tail of.
   */
  image: (_role, values, fields, pixelArt) => {
    const grid = pixelArt ? gridInFront() : null
    const key = grid && promptKeyOf(fields)
    if (!key || !grid) return values

    const written = values[key]
    return typeof written === 'string'
      ? { ...values, [key]: withPixelArtPrompt(written, grid.columns, grid.rows) }
      : values
  },
  video: null,
  '3d': null,
  audio: null,
  material: null,
  skybox: null,
  code: (role, values) => {
    const documentId = activeScriptId(useDocuments.getState())
    // 🛑 Gated on the OPERATION, not on a script being open — see `landingOfRole`.
    const source = reworksItsOutput(role) && documentId ? codeFileOf(documentId)?.source : undefined

    // Absent rather than empty: an empty string is a script that says nothing.
    return {
      ...values,
      [CODE_API_FIELD]: STUDIO_TYPES,
      ...(source ? { [CODE_SOURCE_FIELD]: source } : {}),
    }
  },
  upscale: null,
  'background-removal': null,
  vectorization: null,
  other: null,
}

/** The body as it is sent: the form, plus whatever the family adds to it. */
export function withBodyExtras(
  role: AiRoleId | null,
  values: FormValues,
  {
    fields = [],
    pixelArt = true,
  }: { fields?: readonly FieldDescriptor[]; pixelArt?: boolean } = {},
): FormValues {
  const family = role === null ? null : partsOfRole(role)?.family
  const extras = family ? EXTRAS[family] : null
  return extras && role ? extras(role, values, fields, pixelArt) : values
}
