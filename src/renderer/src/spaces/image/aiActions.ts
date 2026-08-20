import i18next from 'i18next'
import type { FieldDescriptor, ModelFamily } from '@shared/domain/model'
import { layerById } from '@/engines/canvas/canvasState'
import { modelForFamily } from '@/helpers/modelForFamily'
import { reportNotice } from '@/services/diagnostics'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { useModels } from '@/stores/models'
import { fillEditFields } from './aiFields'
import { offerModelsOfFamily } from '@/helpers/offerModel'
import { revealTool } from '@/helpers/revealPanel'

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
  const modelId = modelForFamily(family)
  if (!modelId) {
    offerModelsOfFamily(family)
    return false
  }

  // Described before anything is sent: an upload is a permanent asset in the user's library, and
  // a model with nowhere to put a picture must not cost one.
  const descriptor = await bridge.describeModel(modelId)
  if (!descriptor.fields.some(field => field.kind === 'image')) {
    revealTool('generator')
    return false
  }

  // THROWS rather than answering `false`: the other two refusals above each show something — the
  // model picker, the generator — and this one had nothing to show and said nothing either.
  const image = await host.snapshot()
  if (!image) throw new Error('this image has no picture to send yet')

  const canvas = canvasOf(useCanvases.getState(), documentId)
  const layer = layerById(canvas, canvas.activeLayerId)
  // Asked of the model FIRST, for the reason the image field is asked above: an upload is a
  // permanent asset in the user's library, and a model with nowhere to put a mask must not cost
  // one. Sent to such a model the mask was uploaded, then quietly dropped by `fillEditFields`,
  // and the whole picture was regenerated while the user believed a region had been protected.
  const wantsMask = descriptor.fields.some(field => field.maskFrom !== undefined)
  // `enabled`, not merely present: the canvas does not honour a mask whose box is unticked, and
  // sending it would ask the model to repaint a region nothing on screen shows.
  const mask =
    masked && wantsMask && layer?.mask?.enabled === true ? await host.maskSnapshot(layer.id) : null

  // A NOTICE, not a failure: the edit goes through, with less than it was asked for. Reported as
  // a failure it said the send had failed while it was succeeding — and said it once per model,
  // where every send deserves the warning.
  if (masked && !wantsMask) reportNotice('canvas.edit', i18next.t('imageEdit.maskIgnored'))

  // Sequenced rather than raced: when the second upload fails, the first has already created a
  // permanent asset in the account, and `Promise.all` left it there unnamed and untraceable.
  const imageId = await bridge.uploadAsset(`${documentId}.png`, image)
  const maskId = mask ? await bridge.uploadAsset(`${documentId}-mask.png`, mask) : null

  const values = fillEditFields(descriptor.fields, {
    image: imageId,
    ...(maskId ? { mask: maskId } : {}),
  })

  useModels.getState().prepare(family, modelId, values)
  revealTool('generator')
  return true
}
