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
} & (
    | { origin: 'assets' | 'result' }
    /**
     * 🛑 The placement it was picked as, REQUIRED by the union: a scene selects nodes, two of them
     * can reference one model, and withdrawing by asset id would take both off. Optional, the
     * panel drew a cross that silently did nothing.
     */
    | { origin: 'scene'; nodeId: string }
  )

/** An input a gesture put there, so taking it off has something to undo. */
export type WithdrawableInput = Extract<GenerationInput, { origin: 'assets' | 'scene' }>

/**
 * 🛑 An ALLOW-list, owned here with the union itself: a result is replaced by the next generation
 * rather than withdrawn, and asking « is it a result? » let a fourth origin get a cross by default
 * — one the hook would then have routed into the shelf branch and deselected by asset id.
 */
export function isWithdrawable(input: GenerationInput): input is WithdrawableInput {
  return input.origin === 'assets' || input.origin === 'scene'
}

/** What the panel is handed to work out its inputs, gathered by `useGenerationContext`. */
export type WorkspaceContent = {
  /** Rows the shelf has selected, whatever their kind. */
  selectedAssets: readonly { id: string; name: string; type: AssetType }[]
  /** The models a scene has selected: the placement, and the catalogue row it references. */
  selectedMeshes: readonly { assetId: string; name: string; nodeId: string }[]
  /** What the last generation produced, kept so a chain can start from it. */
  results: readonly { id: string; name: string; type: AssetType }[]
}

/**
 * Everything the workspace can hand a model, most explicit first. The ORDER is the priority: the
 * panel fills each slot of the contract from the first input that fits it.
 *
 * 🛑 The SCENE opens it, and the shelf follows. Selecting a node used to wipe the shelf's pick, so
 * the question never arose; now the two coexist, and a row picked in a catalogue an hour ago would
 * otherwise outrank the model just clicked in the viewport.
 */
export function availableInputsOf(content: WorkspaceContent): readonly GenerationInput[] {
  const inputs: GenerationInput[] = []
  /**
   * 🛑 One GESTURE, one input — keyed by what withdrawing it undoes, never by the catalogue row.
   * A scene selects placements, so two nodes of one model are two sources and each takes its own
   * cross; everything else is the row itself, so a picture the last generation made and that was
   * then clicked in the shelf arrives once. Keyed by the row throughout, that mesh pair collapsed
   * into one line whose cross visibly did nothing.
   */
  const seen = new Set<string>()

  for (const mesh of content.selectedMeshes) {
    if (seen.has(mesh.nodeId)) continue
    seen.add(mesh.nodeId)
    inputs.push({
      role: 'source',
      kind: 'mesh',
      assetId: mesh.assetId,
      label: mesh.name,
      origin: 'scene',
      nodeId: mesh.nodeId,
    })
  }

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
