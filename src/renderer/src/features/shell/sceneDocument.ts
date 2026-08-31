import i18next from 'i18next'
import { gltfDocumentOf, sceneFromGltf, sceneHoldsMore } from '@/engines/scene/gltfDocument'
import type { SceneState } from '@/engines/scene/sceneState'
import { reportNotice } from '@/services/diagnostics'

/**
 * A scene on its way to and from its file, which is a glTF one and nothing else.
 *
 * Only the refusal lives here: composing a scene needs no catalogue, unlike a sky or a material,
 * so the two halves are the engine's. What this side holds is what a READ found and a write
 * would destroy — which is per document, and therefore not an engine's business.
 */

/** Scenes that opened holding MORE than this studio composes — meshes, buffers, animations. */
const incomplete = new Set<string>()

export const forgetCarriedScene = (documentId: string): void => {
  incomplete.delete(documentId)
}

/** The sentence a refusal says, or `null`. The sky's says the same thing about a scene. */
export const sceneRefusesToSave = (documentId: string): string | null =>
  incomplete.has(documentId) ? i18next.t('documents.saveRefusedSceneHoldsMore') : null

export function scenePayloadOf(state: SceneState, documentId: string): unknown {
  return gltfDocumentOf(state, { documentId, documentKind: 'scene' })
}

export function sceneFromPayloadFile(payload: unknown, documentId: string): SceneState {
  incomplete.delete(documentId)

  const held = sceneHoldsMore(payload)
  if (held.length > 0) {
    incomplete.add(documentId)
    reportNotice('document.load', i18next.t('documents.sceneHoldsMore', { parts: held.join(', ') }))
  }

  return sceneFromGltf(payload)
}
