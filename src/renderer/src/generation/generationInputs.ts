import type { AssetType } from '@shared/domain/asset'
import type { AvailableInput } from '@shared/domain/aiCapability'

/**
 * What the workspace offers a generation, and where it came from — see
 * `docs/ci/adr/ADR-23-la-generation-se-pilote-par-capability.md`.
 *
 * Pure: it is handed the state rather than reading a store, so the resolution can be tested
 * without React and without a browser, and so `import-cycles.test.ts` stays at zero.
 */

/** Where an input came from, which is what the panel says under the thumbnail. */
export type InputOrigin = 'selection' | 'document' | 'result'

export type GenerationInput = AvailableInput & {
  /**
   * The catalogue row it names. Absent for what a document produces on the spot — a canvas
   * flattens when the button is pressed, and there is no asset until it does.
   */
  assetId?: string
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
  /** The picture the canvas in front would flatten to, when it holds one. */
  activePicture: { name: string } | null
  /** The armed layer's mask, and only while its box is ticked — the canvas honours no other. */
  activeMask: { name: string } | null
  /** What the last generation produced, kept so a chain can start from it. */
  results: readonly { id: string; name: string; type: AssetType }[]
}

export const NO_CONTENT: WorkspaceContent = {
  selectedAssets: [],
  selectedMeshes: [],
  activePicture: null,
  activeMask: null,
  results: [],
}

/**
 * Everything the workspace can hand a model, most explicit first.
 *
 * The ORDER is the priority: what the person selected outranks what merely happens to be open,
 * and a result they just made outranks neither — it is offered, never taken. `resolveCapability`
 * reads the list, and the panel fills each contract slot from the first input that fits.
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

  // The document in front, after the selection: someone who picked a picture on the shelf means
  // that one, even while a canvas is open behind it.
  if (content.activePicture) {
    inputs.push({
      role: 'source',
      kind: 'image',
      label: content.activePicture.name,
      origin: 'document',
    })
  }

  // 🛑 A mask is emitted ONLY for something that is one. Judged on kinds alone — a mask and the
  // picture it masks are both `image` — one selected picture made a retouch look reachable, and
  // running it would have repainted the whole canvas instead of the region.
  if (content.activeMask) {
    inputs.push({ role: 'mask', kind: 'image', label: content.activeMask.name, origin: 'document' })
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
