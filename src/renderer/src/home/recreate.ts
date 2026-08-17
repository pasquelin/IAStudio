import type { AssetGeneration, AssetType } from '@shared/domain/asset'
import { openGeneratorOn } from '@/helpers/open-generator'
import { workspaceById, workspaceOfType } from '@/helpers/workspaces'
import { enterWorkspace } from './open'

/**
 * Opens the generator on what produced something, without a single request: the model, the
 * prompt and the parameters are already in hand — the catalogue kept them beside the asset, and
 * a pinned recipe holds nothing else.
 *
 * The order is not free. Leaving the home changes workspace, and `connectPreparation` drops any
 * preparation when it does: preparing first would arm the generator and then disarm it, leaving
 * the panel on whichever model the space already held.
 */
export function recreate(type: AssetType, generation: AssetGeneration): void {
  const workspace = workspaceOfType(type)

  enterWorkspace(workspace)
  openGeneratorOn(workspaceById(workspace).family, generation.modelId, generation.params)
}
