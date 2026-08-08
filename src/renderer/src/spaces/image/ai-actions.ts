import type { FieldDescriptor, ModelFamily } from '@shared/domain/model'
import { layerById } from '@/engines/canvas/canvas-state'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { fillEditFields } from './ai-fields'
import { revealTool } from './reveal-panel'

/** The engine, seen from an edit: it flattens, and it hands back the mask it was painted. */
export type EditHost = {
  snapshot: () => Promise<string | null>
  maskSnapshot: (layerId: string) => Promise<string | null>
}

/** What the main process does with a picture on its way to the API. */
export type EditBridge = {
  uploadAsset: (name: string, image: string) => Promise<string>
  describeModel: (modelId: string) => Promise<{ fields: readonly FieldDescriptor[] }>
}

/**
 * The five edits the canvas offers, and the family of models each one asks for. Declared rather
 * than branched: a sixth is one entry, and none of them names a model.
 */
export type AiEdit = 'regenerate' | 'cutout' | 'enlarge' | 'vectorize' | 'extend'

export const AI_EDITS: Readonly<Record<AiEdit, { family: ModelFamily; masked: boolean }>> = {
  regenerate: { family: 'image', masked: true },
  cutout: { family: 'background-removal', masked: false },
  enlarge: { family: 'upscale', masked: false },
  vectorize: { family: 'vectorization', masked: false },
  extend: { family: 'image', masked: true },
}

/**
 * Prepares an edit and stops there. The form is never short-circuited: the action flattens the
 * document, sends it, finds the family's default model and opens its form on the right fields —
 * and the user submits. That is what keeps every parameter of the model visible (invariant 5),
 * and what makes an edit reviewable before it is paid for.
 *
 * Returns `false` when there is nothing to prepare, so the caller can say why rather than
 * leaving a menu entry that does nothing.
 */
export async function prepareEdit(
  documentId: string,
  edit: AiEdit,
  host: EditHost,
  bridge: EditBridge,
): Promise<boolean> {
  const { family, masked } = AI_EDITS[edit]
  const modelId = useSettings.getState().settings.generation.defaultModels[family]
  if (!modelId) {
    // Never a model chosen on the user's behalf: the panel opens on the family instead.
    revealTool('models')
    return false
  }

  const image = await host.snapshot()
  if (!image) return false

  const canvas = canvasOf(useCanvases.getState(), documentId)
  const layer = layerById(canvas, canvas.activeLayerId)
  const mask = masked && layer?.mask ? await host.maskSnapshot(layer.id) : null

  const [imageId, maskId] = await Promise.all([
    bridge.uploadAsset(`${documentId}.png`, image),
    mask ? bridge.uploadAsset(`${documentId}-mask.png`, mask) : Promise.resolve(null),
  ])

  const descriptor = await bridge.describeModel(modelId)
  const values = fillEditFields(descriptor.fields, {
    image: imageId,
    ...(maskId ? { mask: maskId } : {}),
  })

  useModels.getState().prepare(family, modelId, values)
  revealTool('generator')
  return true
}
