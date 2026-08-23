import type { AssetType } from '@shared/domain/asset'
import type { AvailableInput } from '@shared/domain/aiCapability'

/**
 * What the workspace offers a generation — ADR-23. Handed the state rather than reading a store,
 * so it tests without React and `import-cycles.test.ts` stays at zero.
 */

/** Where an input came from, which is what the panel says under the thumbnail. */
export type InputOrigin = 'selection' | 'result'

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

  for (const asset of content.selectedAssets) {
    inputs.push({
      role: 'source',
      kind: asset.type,
      assetId: asset.id,
      label: asset.name,
      origin: 'selection',
    })
  }

  for (const mesh of content.selectedMeshes) {
    inputs.push({
      role: 'source',
      kind: 'mesh',
      assetId: mesh.id,
      label: mesh.name,
      origin: 'selection',
    })
  }

  for (const result of content.results) {
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
