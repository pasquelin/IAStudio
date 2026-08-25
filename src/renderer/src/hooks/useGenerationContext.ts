import { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { partsOfRole, type AiRoleId } from '@shared/domain/aiRole'
import type { AssetType } from '@shared/domain/asset'
import { availableInputsOf, type GenerationInput } from '@/generation/generationInputs'
import { resolveCapability, type CapabilityChoice } from '@/generation/capabilityResolver'
import { workspaceById } from '@/helpers/workspaces'
import { useAssets, assetsById } from '@/stores/assets'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'
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
  /**
   * Takes one input back off, by undoing the gesture that offered it — the shelf's pick, the
   * scene's. A `result` has no gesture behind it, so it is not withdrawn but replaced by the
   * next generation; the panel draws no way off for one.
   */
  withdraw: (input: GenerationInput) => void
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
  // 🛑 STRINGS across the subscription, never objects: `useShallow` compares the entries with
  // `Object.is`, so an array of fresh `{ id, name }` is a new snapshot every read — an endless
  // re-render the moment a scene holds one selected model. Paired back into rows below.
  const meshKeys = useScenes(
    useShallow(state => (sceneId ? selectedMeshKeysOf(sceneOf(state, sceneId)) : NO_KEYS)),
  )

  const meshes = useMemo(() => meshKeys.map(meshOfKey), [meshKeys])

  // § 24: what the last generation produced, so a chain starts from it without a round trip
  // through the shelf. Ids rather than rows, so a catalogue refresh does not re-render this.
  const producedIds = useJobs(latestGenerationIds)

  const inputs = useMemo(() => {
    const named = (ids: readonly string[]): { id: string; name: string; type: AssetType }[] =>
      ids.flatMap(id => {
        const asset = rows.get(id)
        return asset ? [{ id: asset.id, name: asset.name, type: asset.type }] : []
      })

    return availableInputsOf({
      selectedAssets: named(pickedIds),
      selectedMeshes: meshes,
      results: named(producedIds),
    })
  }, [pickedIds, rows, meshes, producedIds])

  /**
   * 🛑 Undone where it was DONE, never filtered here. A panel-side list of dismissed ids would
   * leave the shelf showing a row as picked while the generation no longer took it, and the two
   * answers to "what is selected" would drift apart with nothing to reconcile them.
   */
  const withdraw = useCallback(
    (input: GenerationInput) => {
      if (input.origin === 'assets') {
        // Read at CALL time and FILTERED, never toggled against the render that drew the row: a
        // click landing after the selection moved would otherwise put the asset back.
        const picked = selectedAssetIds(useSelection.getState())
        useSelection.getState().selectAssets(picked.filter(id => id !== input.assetId))
        return
      }

      if (input.origin === 'scene' && input.nodeId !== undefined && sceneId !== null) {
        selectIn(sceneId, [input.nodeId], 'toggle')
      }
    },
    [sceneId],
  )

  // Memoised with the inputs it reads: the resolution allocates a contract per required input,
  // and the panel re-renders on every keystroke of the form below it.
  const capability = useMemo(
    () => resolveCapability(family, inputs, forced),
    [family, inputs, forced],
  )

  return useMemo(() => ({ inputs, capability, withdraw }), [inputs, capability, withdraw])
}

/** Stable, so a workspace with no scene open does not hand React a new array per render. */
const NO_KEYS: readonly string[] = []

/** A separator no node name can hold, so the three parts travel as one comparable string. */
const KEY_PART = '\u0000'

/**
 * The meshes a scene has selected, by the catalogue row each placement references.
 *
 * A node is not an asset: what a scene selects is a placement, and anything but a model has no
 * file to send.
 */
function selectedMeshKeysOf(scene: ReturnType<typeof sceneOf>): readonly string[] {
  const picked = scene.nodes.flatMap(node =>
    node.type === 'model' && scene.selectedIds.includes(node.id)
      ? [`${node.id}${KEY_PART}${node.model.assetId}${KEY_PART}${node.name}`]
      : [],
  )

  return picked.length === 0 ? NO_KEYS : picked
}

function meshOfKey(key: string): { id: string; name: string; nodeId: string } {
  const [nodeId = '', id = '', name = ''] = key.split(KEY_PART)
  return { id, name, nodeId }
}
