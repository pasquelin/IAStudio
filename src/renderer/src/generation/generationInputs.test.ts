import { describe, expect, it } from 'vitest'
import { availableInputsOf, NO_CONTENT, type WorkspaceContent } from './generationInputs'

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
      { role: 'source', kind: 'image', assetId: 'a1', label: 'car.png', origin: 'selection' },
    ])
  })

  // A node is not an asset: what a scene selects is a placement, and the file it stands for is
  // the row its model names.
  it('offers the mesh a selected scene node stands for', () => {
    const inputs = availableInputsOf(content({ selectedMeshes: [{ id: 'm1', name: 'Robot' }] }))

    expect(inputs[0]).toMatchObject({ role: 'source', kind: 'mesh', assetId: 'm1' })
  })

  /**
   * 🛑 The panel takes the open document on its own, so what it took has to be readable before
   * the button is pressed — § 10. A canvas has no asset until it flattens, which is why this one
   * carries a label and no id.
   */
  it('offers the open canvas, with no id to show for it yet', () => {
    const inputs = availableInputsOf(content({ activePicture: { name: 'Sans titre 1' } }))

    expect(inputs).toEqual([
      { role: 'source', kind: 'image', label: 'Sans titre 1', origin: 'document' },
    ])
  })

  /**
   * 🛑 The one input that is not a source. A mask and the picture it masks are both `image`, so
   * emitting it as a source made a retouch look reachable from one selected picture — and
   * running it would have repainted the whole canvas instead of the region.
   */
  it('offers a mask as a mask, never as another picture', () => {
    const inputs = availableInputsOf(content({ activeMask: { name: 'Calque 2' } }))

    expect(inputs).toEqual([{ role: 'mask', kind: 'image', label: 'Calque 2', origin: 'document' }])
  })

  /**
   * The order IS the priority, and the panel fills each contract slot from the first input that
   * fits: someone who picked a picture on the shelf means that one, even while a canvas is open.
   */
  it('puts what was selected ahead of what merely happens to be open', () => {
    const inputs = availableInputsOf(
      content({
        selectedAssets: [{ id: 'a1', name: 'concept.png', type: 'image' }],
        activePicture: { name: 'Sans titre 1' },
      }),
    )

    expect(inputs.map(input => input.origin)).toEqual(['selection', 'document'])
  })

  // § 24: a result becomes a source without a round trip through the shelf — offered, never taken.
  it('offers what the last generation produced, behind everything else', () => {
    const inputs = availableInputsOf(
      content({
        activePicture: { name: 'Sans titre 1' },
        results: [{ id: 'r1', name: 'robot.png', type: 'image' }],
      }),
    )

    expect(inputs.map(input => input.origin)).toEqual(['document', 'result'])
  })
})
