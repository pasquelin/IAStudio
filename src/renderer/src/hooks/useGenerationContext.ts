import { useMemo } from 'react'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import { layerById } from '@/engines/canvas/canvasState'
import type { AssetType } from '@shared/domain/asset'
import { availableInputsOf, type GenerationInput } from '@/generation/generationInputs'
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

  /**
   * 🛑 The narrow answers, never the document states: every scene command and every canvas edit
   * replaces those objects, and a subscription to one turned a gizmo drag into a re-render of the
   * whole panel — form, picker and sources.
   */
  const sceneId = useDocuments(activeSceneId)
  const meshes = useScenes(state => (sceneId ? selectedMeshesOf(sceneOf(state, sceneId)) : NONE))

  // § 24: what the last generation produced, so a chain starts from it without a round trip
  // through the shelf. Ids rather than rows, so a catalogue refresh does not re-render this.
  const producedIds = useJobs(latestGenerationIds)

  const imageId = useDocuments(activeImageId)
  const maskedLayer = useCanvases(state => (imageId ? maskedLayerNameOf(state, imageId) : null))
  const picture = useDocuments(state =>
    imageId ? (state.documents[imageId]?.title ?? null) : null,
  )

  const inputs = useMemo(() => {
    const named = (ids: readonly string[]): { id: string; name: string; type: AssetType }[] =>
      ids.flatMap(id => {
        const asset = rows.get(id)
        return asset ? [{ id: asset.id, name: asset.name, type: asset.type }] : []
      })

    return availableInputsOf({
      selectedAssets: named(pickedIds),
      selectedMeshes: meshes,
      activePicture: picture === null ? null : { name: picture },
      activeMask: maskedLayer === null ? null : { name: maskedLayer },
      results: named(producedIds),
    })
  }, [pickedIds, rows, meshes, picture, maskedLayer, producedIds])

  // Memoised with the inputs it reads: the resolution allocates a contract per required input,
  // and the panel re-renders on every keystroke of the form below it.
  const capability = useMemo(
    () => resolveCapability(family, inputs, forced),
    [family, inputs, forced],
  )

  return useMemo(() => ({ inputs, capability }), [inputs, capability])
}

/** Stable, so a workspace with no scene open does not hand React a new array per render. */
const NONE: readonly { id: string; name: string }[] = []

/**
 * The meshes a scene has selected, by the catalogue row each placement references.
 *
 * A node is not an asset: what a scene selects is a placement, and anything but a model has no
 * file to send.
 */
function selectedMeshesOf(
  scene: ReturnType<typeof sceneOf>,
): readonly { id: string; name: string }[] {
  const picked = scene.nodes.flatMap(node =>
    node.type === 'model' && scene.selectedIds.includes(node.id)
      ? [{ id: node.model.assetId, name: node.name }]
      : [],
  )

  return picked.length === 0 ? NONE : picked
}

/**
 * The armed layer's name when its mask is ticked, and nothing otherwise. `enabled`, not merely
 * present: the canvas does not honour a mask whose box is unticked, and offering it would ask
 * the model to repaint a region nothing on screen shows.
 */
function maskedLayerNameOf(
  state: Parameters<typeof canvasOf>[0],
  documentId: string,
): string | null {
  const canvas = canvasOf(state, documentId)
  const layer = layerById(canvas, canvas.activeLayerId)

  return layer?.mask?.enabled === true ? layer.name : null
}
