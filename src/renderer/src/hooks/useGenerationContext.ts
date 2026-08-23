import { useMemo } from 'react'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import { layerById } from '@/engines/canvas/canvasState'
import {
  availableInputsOf,
  type GenerationInput,
  type WorkspaceContent,
} from '@/generation/generationInputs'
import { resolveCapability, type CapabilityChoice } from '@/generation/capabilityResolver'
import { workspaceById } from '@/helpers/workspaces'
import { useAssets, assetsById } from '@/stores/assets'
import { canvasOf, useCanvases } from '@/stores/canvases'
import { activeImageId, activeSceneId, useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { sceneOf, useScenes } from '@/stores/scenes'
import { latestGenerationIds, useJobs } from '@/stores/jobs'
import { selectedAssetIds, useSelection } from '@/stores/selection'

/**
 * What the AI side knows of the workspace right now — the § 9 of the brief.
 *
 * The panel reads THIS and never a viewport: the resolution is pure (`generationInputs.ts`,
 * `capabilityResolver.ts`) and this is the one place that gathers the state it works from.
 */
export type GenerationContext = {
  inputs: readonly GenerationInput[]
  capability: CapabilityChoice
}

/**
 * Gathers what is at hand and works out the operation it points at.
 *
 * `forced` is what the person asked for explicitly, and it wins while the context can still
 * reach it — § 21: a selection changing under their hand must not take the operation away.
 */
export function useGenerationContext(forced: AiRoleId | null): GenerationContext {
  const workspace = useLayouts(state => state.activeWorkspace)
  // The forced employment's own family, when it has one: a canvas edit reaches OUTSIDE the space
  // it was made in — Enlarge asks for an upscaler while the image workspace is in front.
  const family = (forced && partsOfRole(forced)?.family) ?? workspaceById(workspace).family

  const pickedIds = useSelection(selectedAssetIds)
  const rows = useAssets(assetsById)

  const sceneId = useDocuments(activeSceneId)
  const scene = useScenes(state => (sceneId ? sceneOf(state, sceneId) : null))

  // § 24: what the last generation produced, so a chain starts from it without a round trip
  // through the shelf. Ids rather than rows, so a catalogue refresh does not re-render this.
  const producedIds = useJobs(latestGenerationIds)

  const imageId = useDocuments(activeImageId)
  const canvas = useCanvases(state => (imageId ? canvasOf(state, imageId) : null))
  const document = useDocuments(state => (imageId ? state.documents[imageId] : undefined))

  const content = useMemo((): WorkspaceContent => {
    const selectedAssets = pickedIds.flatMap(id => {
      const asset = rows.get(id)
      return asset ? [{ id: asset.id, name: asset.name, type: asset.type }] : []
    })

    // A node is not an asset: what a scene selects is a placement, and the mesh it stands for is
    // the row its `model` names. Anything else selected there has no file to send.
    const selectedMeshes = (scene?.nodes ?? []).flatMap(node =>
      node.type === 'model' && scene?.selectedIds.includes(node.id)
        ? [{ id: node.model.assetId, name: node.name }]
        : [],
    )

    const layer = canvas ? layerById(canvas, canvas.activeLayerId) : null

    return {
      selectedAssets,
      selectedMeshes,
      activePicture: document ? { name: document.title } : null,
      // `enabled`, not merely present: the canvas does not honour a mask whose box is unticked,
      // and offering it would ask the model to repaint a region nothing on screen shows.
      activeMask: layer?.mask?.enabled === true ? { name: layer.name } : null,
      results: producedIds.flatMap(id => {
        const asset = rows.get(id)
        return asset ? [{ id: asset.id, name: asset.name, type: asset.type }] : []
      }),
    }
  }, [pickedIds, rows, scene, canvas, document, producedIds])

  const inputs = useMemo(() => availableInputsOf(content), [content])

  return {
    inputs,
    capability: resolveCapability(family, inputs, forced),
  }
}
