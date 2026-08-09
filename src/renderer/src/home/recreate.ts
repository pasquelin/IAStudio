import type { AssetGeneration, AssetType } from '@shared/domain/asset'
import { revealTool } from '@/helpers/reveal-panel'
import { workspaceById, workspaceOfType } from '@/helpers/workspaces'
import { useModels } from '@/stores/models'
import { enterWorkspace } from './open'

/**
 * Opens the generator on what produced something, without a single request: the model, the
 * prompt and the parameters are already in hand — the catalogue kept them beside the asset.
 *
 * The order is not free. Leaving the home changes workspace, and `connectPreparation` drops any
 * preparation when it does: preparing first would arm the generator and then disarm it, leaving
 * the panel on whichever model the space already held.
 *
 * The seed is deliberately left out, as the inspector's "regenerate" leaves it out: replaying it
 * asks for the picture one already has, and what this offers is another take on the same idea.
 */
export function recreate(type: AssetType, generation: AssetGeneration): void {
  const workspace = workspaceOfType(type)

  enterWorkspace(workspace)
  useModels
    .getState()
    .prepare(workspaceById(workspace).family, generation.modelId, generation.params)
  // The generator may well be closed — it is a tool window like any other.
  revealTool('generator')
}
