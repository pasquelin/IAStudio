import type { AssetType } from '@shared/domain/asset'
import type { AvailableInput } from '@shared/domain/aiCapability'

/**
 * What the workspace offers a generation — ADR-23. Handed the state rather than reading a store,
 * so it tests without React and `import-cycles.test.ts` stays at zero.
 */

/**
 * Where an input came from. It names what the panel writes under the thumbnail AND what taking
 * the input off has to undo — a source nobody can trace to a gesture is one nobody can withdraw.
 */
export type InputOrigin =
  /** Rows the asset shelf has picked. */
  | 'assets'
  /** Placements the scene in front has picked. */
  | 'scene'
  /** What the last generation produced, so a chain starts from it. */
  | 'result'

/** Walked by `dynamic-keys.i18n.test.ts`: the sentence under each thumbnail is composed. */
export const INPUT_ORIGINS: readonly InputOrigin[] = ['assets', 'scene', 'result']

export type GenerationInput = AvailableInput & {
  /**
   * 🛑 The catalogue row it names, and never optional: an input the panel cannot ATTACH is one it
   * would draw and never send. A canvas has no asset until it flattens, and flattening is
   * `prepareEdit`'s gesture — this panel has no upload of its own.
   */
  assetId: string
  /** What the panel draws beside the thumbnail. Document data, never a word of the interface. */
  label: string
  origin: InputOrigin
}

/** What the panel is handed to work out its inputs, gathered by `useGenerationContext`. */
export type WorkspaceContent = {
  /** Rows the shelf has selected, whatever their kind. */
  selectedAssets: readonly { id: string; name: string; type: AssetType }[]
  /** The models a scene has selected, by the catalogue row each one references. */
  selectedMeshes: readonly { id: string; name: string }[]
  /** What the last generation produced, kept so a chain can start from it. */
  results: readonly { id: string; name: string; type: AssetType }[]
}

/**
 * Everything the workspace can hand a model, most explicit first. The ORDER is the priority: the
 * panel fills each slot of the contract from the first input that fits it.
 */
export function availableInputsOf(content: WorkspaceContent): readonly GenerationInput[] {
  const inputs: GenerationInput[] = []
  // 🛑 One row, ONE input, whichever way it reached the panel. A picture the last generation made
  // and that was then clicked in the shelf arrived twice, so withdrawing the shelf's pick left the
  // result's copy filling the very same field — a cross that promised to take it off the
  // generation and did not. The first occurrence wins, which is what the ORDER below decides.
  const seen = new Set<string>()

  for (const asset of content.selectedAssets) {
    if (seen.has(asset.id)) continue
    seen.add(asset.id)
    inputs.push({
      role: 'source',
      kind: asset.type,
      assetId: asset.id,
      label: asset.name,
      origin: 'assets',
    })
  }

  for (const mesh of content.selectedMeshes) {
    if (seen.has(mesh.id)) continue
    seen.add(mesh.id)
    inputs.push({
      role: 'source',
      kind: 'mesh',
      assetId: mesh.id,
      label: mesh.name,
      origin: 'scene',
    })
  }

  for (const result of content.results) {
    if (seen.has(result.id)) continue
    seen.add(result.id)
    inputs.push({
      role: 'source',
      kind: result.type,
      assetId: result.id,
      label: result.name,
      origin: 'result',
    })
  }

  return inputs
}
