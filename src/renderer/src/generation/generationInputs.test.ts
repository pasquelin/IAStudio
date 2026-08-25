import { describe, expect, it } from 'vitest'
import { availableInputsOf, type WorkspaceContent } from './generationInputs'

const NO_CONTENT: WorkspaceContent = { selectedAssets: [], selectedMeshes: [], results: [] }

const content = (over: Partial<WorkspaceContent> = {}): WorkspaceContent => ({
  ...NO_CONTENT,
  ...over,
})

describe('what the workspace offers a generation', () => {
  it('offers nothing at all from an empty workspace', () => {
    expect(availableInputsOf(NO_CONTENT)).toEqual([])
  })

  it('offers a selected row under the kind the catalogue filed it as', () => {
    const inputs = availableInputsOf(
      content({ selectedAssets: [{ id: 'a1', name: 'car.png', type: 'image' }] }),
    )

    expect(inputs).toEqual([
      { role: 'source', kind: 'image', assetId: 'a1', label: 'car.png', origin: 'assets' },
    ])
  })

  // A node is not an asset: what a scene selects is a placement, and the file it stands for is
  // the row its model names.
  it('offers the mesh a selected scene node stands for', () => {
    const inputs = availableInputsOf(
      content({ selectedMeshes: [{ id: 'm1', name: 'Robot', nodeId: 'n1' }] }),
    )

    // The node travels beside the row: two placements of one model are two sources, and taking
    // one off has to deselect the placement rather than the file both of them name.
    expect(inputs[0]).toMatchObject({ role: 'source', kind: 'mesh', assetId: 'm1', nodeId: 'n1' })
  })

  /**
   * The order IS the priority, and the panel fills each contract slot from the first input that
   * fits: someone who picked a picture on the shelf means that one, even while a canvas is open.
   */
  it('puts what was selected ahead of what was merely produced', () => {
    const inputs = availableInputsOf(
      content({
        selectedAssets: [{ id: 'a1', name: 'concept.png', type: 'image' }],
        results: [{ id: 'r1', name: 'robot.png', type: 'image' }],
      }),
    )

    expect(inputs.map(input => input.origin)).toEqual(['assets', 'result'])
  })

  // § 24: a result becomes a source without a round trip through the shelf — offered, never taken.
  /**
   * 🛑 Every input NAMES a catalogue row. One the panel cannot attach is one it would draw and
   * never send — the defect this list exists to prevent.
   */
  it('names a row for every input it offers', () => {
    const inputs = availableInputsOf(
      content({
        selectedMeshes: [{ id: 'm1', name: 'Robot', nodeId: 'n1' }],
        results: [{ id: 'r1', name: 'robot.png', type: 'image' }],
      }),
    )

    expect(inputs.every(input => input.assetId !== '')).toBe(true)
    expect(inputs.map(input => input.assetId)).toEqual(['m1', 'r1'])
  })
})
