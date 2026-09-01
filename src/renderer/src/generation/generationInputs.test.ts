import { describe, expect, it } from 'vitest'
import { availableInputsOf, type WorkspaceContent } from './generationInputs'

const NO_CONTENT: WorkspaceContent = { selectedFiles: [], selectedMeshes: [], results: [] }

const content = (over: Partial<WorkspaceContent> = {}): WorkspaceContent => ({
  ...NO_CONTENT,
  ...over,
})

describe('what the workspace offers a generation', () => {
  it('offers nothing at all from an empty workspace', () => {
    expect(availableInputsOf(NO_CONTENT)).toEqual([])
  })

  it('offers a picked file under the kind the catalogue filed it as', () => {
    const inputs = availableInputsOf(
      content({
        selectedFiles: [{ assetId: 'a1', name: 'car.png', path: 'Images/car.png', type: 'image' }],
      }),
    )

    expect(inputs).toEqual([
      {
        role: 'source',
        kind: 'image',
        assetId: 'a1',
        label: 'car.png',
        origin: 'explorer',
        path: 'Images/car.png',
      },
    ])
  })

  // A node is not an asset: what a scene selects is a placement, and the file it stands for is
  // the row its model names.
  it('offers the mesh a selected scene node stands for', () => {
    const inputs = availableInputsOf(
      content({ selectedMeshes: [{ assetId: 'm1', name: 'Robot', nodeId: 'n1' }] }),
    )

    // The node travels beside the row: two placements of one model are two sources, and taking
    // one off has to deselect the placement, not the file both of them name.
    expect(inputs[0]).toMatchObject({
      role: 'source',
      kind: 'mesh',
      assetId: 'm1',
      nodeId: 'n1',
      origin: 'scene',
    })
  })

  // A mesh picked an hour ago would otherwise be handed to the contract ahead of the model just
  // clicked in the scene.
  it('puts what the scene holds ahead of what the explorer holds', () => {
    const inputs = availableInputsOf(
      content({
        selectedFiles: [{ assetId: 'a1', name: 'crate.glb', path: '3D/crate.glb', type: 'mesh' }],
        selectedMeshes: [{ assetId: 'm1', name: 'Robot', nodeId: 'n1' }],
      }),
    )

    expect(inputs.map(input => input.origin)).toEqual(['scene', 'explorer'])
  })

  /**
   * The order IS the priority, and the panel fills each contract slot from the first input that
   * fits: someone who picked a picture in the explorer means that one, even while a canvas is open.
   */
  it('puts what was picked ahead of what was merely produced', () => {
    const inputs = availableInputsOf(
      content({
        selectedFiles: [
          { assetId: 'a1', name: 'concept.png', path: 'Images/concept.png', type: 'image' },
        ],
        results: [{ id: 'r1', name: 'robot.png', type: 'image' }],
      }),
    )

    expect(inputs.map(input => input.origin)).toEqual(['explorer', 'result'])
  })

  /**
   * A generated picture picked in the explorer is one thing that reached the panel two ways.
   * Listed twice, taking the explorer's pick off left the result's copy filling the very same
   * field — which is why the file is keyed by its ROW rather than by its path.
   */
  it('offers one row once, whichever way it reached the panel', () => {
    const inputs = availableInputsOf(
      content({
        selectedFiles: [
          { assetId: 'r1', name: 'robot.png', path: 'Images/robot.png', type: 'image' },
        ],
        results: [{ id: 'r1', name: 'robot.png', type: 'image' }],
      }),
    )

    expect(inputs.map(input => input.origin)).toEqual(['explorer'])
  })

  // § 24: a result becomes a source without a round trip through the shelf — offered, never taken.
  /**
   * 🛑 Every input NAMES a catalogue row. One the panel cannot attach is one it would draw and
   * never send — the defect this list exists to prevent.
   */
  it('names a row for every input it offers', () => {
    const inputs = availableInputsOf(
      content({
        selectedMeshes: [{ assetId: 'm1', name: 'Robot', nodeId: 'n1' }],
        results: [{ id: 'r1', name: 'robot.png', type: 'image' }],
      }),
    )

    expect(inputs.every(input => input.assetId !== '')).toBe(true)
    expect(inputs.map(input => input.assetId)).toEqual(['m1', 'r1'])
  })
})
