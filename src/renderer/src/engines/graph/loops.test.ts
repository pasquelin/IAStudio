import { describe, expect, it } from 'vitest'
import type { GraphNode } from '@shared/domain/graph'
import { forEachEndNode, forEachNode, graphOf, textNode } from './graph-fixtures'
import { loopInputId, loopOutputId } from './handles'
import { addedList, loopListsOf, loopsOf, namedLoopId, removedList, setListKind } from './loops'

const idsOf = (handles: readonly { id: string }[]): readonly string[] => handles.map(h => h.id)

describe('loopListsOf', () => {
  it('pairs an input with the output carrying the same number', () => {
    const lists = loopListsOf(forEachNode('forEach1', ['image', 'text']))

    expect(lists.map(list => list.index)).toEqual([0, 1])
    expect(lists[0]?.input?.id).toBe(loopInputId('forEach1', 0))
    expect(lists[0]?.output?.id).toBe(loopOutputId('forEach1', 0))
    expect(lists.map(list => list.kind)).toEqual(['image', 'text'])
  })

  it('leaves out the conditional port every node carries', () => {
    expect(loopListsOf(forEachNode('forEach1', []))).toEqual([])
  })

  // The converter pairs by the NUMBER it parses, never by position, so a file whose lists were
  // renumbered by a deletion still holds as many lists as it has pairs.
  it('reads lists whose numbers do not run from zero', () => {
    const node: GraphNode = {
      id: 'forEach1',
      type: 'forEach',
      position: { x: 0, y: 0 },
      data: {
        inputHandles: [{ id: loopInputId('forEach1', 7) }],
        outputHandles: [{ id: loopOutputId('forEach1', 7), type: 'text' }],
      },
    }

    expect(loopListsOf(node)).toEqual([
      { index: 7, kind: 'text', input: { id: 'forEach1-input-7' }, output: expect.anything() },
    ])
  })

  // `getForEachIterationRefName` in the converter: `type === 'text'` gives `text${n}`, and
  // everything else — an untyped port included — gives `image${n}`.
  it('calls an untyped list a picture list, as the converter does', () => {
    const node: GraphNode = {
      id: 'forEach1',
      type: 'forEach',
      position: { x: 0, y: 0 },
      data: { outputHandles: [{ id: loopOutputId('forEach1', 0) }] },
    }

    expect(loopListsOf(node)[0]?.kind).toBe('image')
  })

  it('reads a list missing one of its two ports rather than dropping it', () => {
    const node: GraphNode = {
      id: 'forEach1',
      type: 'forEach',
      position: { x: 0, y: 0 },
      data: { inputHandles: [{ id: loopInputId('forEach1', 0) }] },
    }

    expect(loopListsOf(node)[0]).toMatchObject({ index: 0, output: undefined })
  })

  /**
   * A number past `Number.MAX_SAFE_INTEGER` is not a list: two of them round to the SAME float,
   * so a file holding both would show one list and hand the converter two ports it pairs apart.
   */
  it('refuses a port numbered past what a number can tell apart', () => {
    const node: GraphNode = {
      id: 'forEach1',
      type: 'forEach',
      position: { x: 0, y: 0 },
      data: { inputHandles: [{ id: 'forEach1-input-99999999999999999999' }] },
    }

    expect(loopListsOf(node)).toEqual([])
  })

  // `parseGraph` validates the node and not its `data`: everything below comes off a file, and
  // reading `.id` off any of it took the whole inspector into its error boundary.
  it('survives handles a file wrote', () => {
    const node = {
      id: 'forEach1',
      type: 'forEach',
      position: { x: 0, y: 0 },
      data: { inputHandles: [null, { id: 12 }, 'nope'], outputHandles: {} },
    }
    // The one cast of the suite, and what it buys: `data` is typed as the editor writes it, and
    // the case being tested is a file that did not.
    const read = (): unknown => loopListsOf(node as unknown as GraphNode)

    expect(read).not.toThrow()
    expect(read()).toEqual([])
  })
})

describe('addedList', () => {
  it('adds one port on each side, sharing a number', () => {
    const patch = addedList(forEachNode('forEach1', ['image']), 'text')

    expect(idsOf(patch.inputHandles)).toContain(loopInputId('forEach1', 1))
    expect(idsOf(patch.outputHandles)).toContain(loopOutputId('forEach1', 1))
    expect(patch.outputHandles.at(-1)?.type).toBe('text')
  })

  it('keeps the ports already there, conditional included', () => {
    const patch = addedList(forEachNode('forEach1', ['image']), 'image')

    expect(idsOf(patch.inputHandles)).toEqual([
      'forEach1-source-conditional',
      loopInputId('forEach1', 0),
      loopInputId('forEach1', 1),
    ])
  })

  // One past the HIGHEST, not the count: numbered on the count, a node holding 0 and 7 would get
  // a second `input-1`, and the converter's `.find` would hand the flow whichever came first.
  it('numbers past the highest a gapped node already holds', () => {
    const node: GraphNode = {
      id: 'forEach1',
      type: 'forEach',
      position: { x: 0, y: 0 },
      data: { inputHandles: [{ id: loopInputId('forEach1', 7) }] },
    }

    expect(idsOf(addedList(node, 'image').inputHandles)).toContain(loopInputId('forEach1', 8))
  })
})

describe('removedList', () => {
  it('drops both ports of the list named', () => {
    const patch = removedList(forEachNode('forEach1', ['image', 'text']), 0)

    expect(idsOf(patch.inputHandles)).toEqual([
      'forEach1-source-conditional',
      loopInputId('forEach1', 1),
    ])
    expect(idsOf(patch.outputHandles)).toEqual([loopOutputId('forEach1', 1)])
  })

  // The survivor keeps its NUMBER, which is what keeps its wires: renumbered to close the gap, the
  // flow input of one list would be handed to the item port of another, and no error would say so.
  it('leaves the survivors their numbers', () => {
    const patch = removedList(forEachNode('forEach1', ['image', 'text', 'image']), 1)

    expect(idsOf(patch.outputHandles)).toEqual([
      loopOutputId('forEach1', 0),
      loopOutputId('forEach1', 2),
    ])
  })
})

describe('setListKind', () => {
  it('retypes both ports of the list at once', () => {
    const patch = setListKind(forEachNode('forEach1', ['image', 'image']), 1, 'text')

    expect(patch.inputHandles.at(-1)).toMatchObject({
      id: loopInputId('forEach1', 1),
      type: 'text',
    })
    expect(patch.outputHandles.at(-1)).toMatchObject({ type: 'text' })
  })

  it('leaves the other lists and the conditional port alone', () => {
    const patch = setListKind(forEachNode('forEach1', ['image', 'image']), 1, 'text')

    expect(patch.inputHandles[0]).toMatchObject({ type: 'conditional' })
    expect(patch.outputHandles[0]).toMatchObject({ type: 'image' })
  })
})

describe('namedLoopId', () => {
  it('answers the loop the end names', () => {
    expect(namedLoopId(forEachEndNode('end1', 'forEach1'))).toBe('forEach1')
  })

  // Kept rather than forgotten: a picker whose value matches no option renders blank, so an end
  // naming a deleted loop would read as one that closes nothing. `withChosen` shows it instead.
  it('answers a loop the graph no longer holds', () => {
    expect(namedLoopId(forEachEndNode('end1', 'gone'))).toBe('gone')
  })

  it('answers nothing for an end that names none', () => {
    expect(namedLoopId(forEachEndNode('end1'))).toBeUndefined()
  })

  it('answers nothing for a node that is not the end of a loop', () => {
    expect(namedLoopId(textNode('text1'))).toBeUndefined()
  })

  // `parseGraph` validates the node and not its `data`: a number here would reach a `<select>` as
  // its value, and React would hand the DOM `"12"` over a loop nobody named.
  it('answers nothing for a parent a file wrote as a number', () => {
    const node = {
      id: 'end1',
      type: 'forEachEnd',
      position: { x: 0, y: 0 },
      data: { parentNodeId: 12 },
    }

    expect(namedLoopId(node as unknown as GraphNode)).toBeUndefined()
  })
})

describe('loopsOf', () => {
  it('keeps the loops and nothing else', () => {
    const graph = graphOf([textNode('text1'), forEachNode('forEach1'), forEachEndNode('end1')], [])

    expect(loopsOf(graph).map(node => node.id)).toEqual(['forEach1'])
  })
})
