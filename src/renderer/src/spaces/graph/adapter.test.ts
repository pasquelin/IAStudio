import { describe, expect, it } from 'vitest'
import type { NodeChange } from '@xyflow/react'
import type { GraphState } from '@shared/domain/graph'
import {
  canvasNodesOf,
  isDragging,
  movesIn,
  removalsIn,
  selectionAfter,
  toCanvasEdges,
} from './adapter'

const toCanvasNodes = (state: GraphState, selected: ReadonlySet<string> = new Set()) =>
  canvasNodesOf(state, selected)

const graph: GraphState = {
  nodes: [
    { id: 'text1', type: 'text', position: { x: 0, y: 0 }, data: { value: 'a rock' } },
    { id: 'note1', type: 'stickyNote', position: { x: 10, y: 20 }, data: {}, width: 200 },
  ],
  edges: [
    {
      id: 'text1-target-output--TO--model1-source-prompt',
      source: 'model1',
      target: 'text1',
      sourceHandle: 'model1-source-prompt',
      targetHandle: 'text1-target-output',
    },
  ],
  inputKeys: [],
}

describe('handing the graph to the canvas', () => {
  it('carries the id, the type, the position and the data of each node', () => {
    expect(toCanvasNodes(graph)[0]).toEqual({
      id: 'text1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { value: 'a rock' },
      selected: false,
    })
  })

  /**
   * A fully controlled canvas keeps no selection of its own: what is not handed to it is not
   * selected, and the delete key — which acts on the selection — would find nothing to delete.
   */
  it('hands the selection back down, since the canvas keeps none', () => {
    const [text, note] = toCanvasNodes(graph, new Set(['text1']))

    expect(text?.selected).toBe(true)
    expect(note?.selected).toBe(false)
  })

  /**
   * React Flow drops a node's measurements when its object changes identity, and re-subscribes
   * its `ResizeObserver`. Rebuilding the whole list did that to every node on every frame of a
   * drag, for the one node that had actually moved.
   */
  it('hands an untouched node back as the very same object', () => {
    const first = canvasNodesOf(graph, new Set())
    const moved: GraphState = {
      ...graph,
      nodes: [{ ...graph.nodes[0]!, position: { x: 50, y: 50 } }, graph.nodes[1]!],
    }

    const second = canvasNodesOf(moved, new Set())

    expect(second[0]).not.toBe(first[0])
    expect(second[1]).toBe(first[1])
  })

  it('rebuilds a node whose selection changed, and nothing else', () => {
    const first = canvasNodesOf(graph, new Set())
    const second = canvasNodesOf(graph, new Set(['text1']))

    expect(second[0]).not.toBe(first[0])
    expect(second[1]).toBe(first[1])
  })

  it('carries a width only where one was set', () => {
    const [text, note] = toCanvasNodes(graph)

    expect(text).not.toHaveProperty('width')
    expect(note).toHaveProperty('width', 200)
  })

  /** Reversed, every export would be — and neither the API nor the validator would say a word. */
  it('leaves the inverted edge convention exactly as it stands', () => {
    expect(toCanvasEdges(graph, new Set())[0]).toMatchObject({ source: 'model1', target: 'text1' })
  })
})

describe('reading back what the canvas did', () => {
  const move = (id: string, x: number, y: number, dragging: boolean): NodeChange => ({
    type: 'position',
    id,
    position: { x, y },
    dragging,
  })

  /**
   * React Flow reports a drag as a change per frame. Keeping every one of them would be one undo
   * entry per frame the moment the coalescing id changed.
   */
  it('keeps only where each node ended up', () => {
    const moves = movesIn([move('text1', 1, 1, true), move('text1', 9, 9, true)])

    expect(moves.get('text1')).toEqual({ x: 9, y: 9 })
    expect(moves.size).toBe(1)
  })

  it('says a drag is still under the pointer, so the gesture stays open', () => {
    expect(isDragging([move('text1', 1, 1, true)])).toBe(true)
    expect(isDragging([move('text1', 1, 1, false)])).toBe(false)
  })

  it('names the nodes a change removes', () => {
    expect(removalsIn([{ type: 'remove', id: 'text1' }, move('note1', 0, 0, false)])).toEqual([
      'text1',
    ])
  })

  // A measurement is React Flow's own business, and this is where it stops.
  it('reads no move and no removal out of a measurement', () => {
    const changes: NodeChange[] = [
      { type: 'dimensions', id: 'text1', dimensions: { width: 10, height: 10 } },
    ]

    expect(movesIn(changes).size).toBe(0)
    expect(removalsIn(changes)).toEqual([])
  })
})

describe('what stays selected', () => {
  it('adds and drops what the canvas reports', () => {
    const selected = selectionAfter(new Set(), [{ type: 'select', id: 'text1', selected: true }])

    expect([...selected]).toEqual(['text1'])
    expect([
      ...selectionAfter(selected, [{ type: 'select', id: 'text1', selected: false }]),
    ]).toEqual([])
  })

  /** A node that is gone cannot stay selected, or the delete key would act on it for ever. */
  it('drops a node the canvas removed', () => {
    expect([...selectionAfter(new Set(['text1']), [{ type: 'remove', id: 'text1' }])]).toEqual([])
  })

  /** Edges go through the very same set: unselected, one cannot be deleted from the keyboard. */
  it('carries the selection of an edge as well as of a node', () => {
    const edgeId = 'text1-target-output--TO--model1-source-prompt'
    const selected = selectionAfter(new Set(), [{ type: 'select', id: edgeId, selected: true }])

    expect(toCanvasEdges(graph, selected)[0]?.selected).toBe(true)
    expect(toCanvasEdges(graph, new Set())[0]?.selected).toBe(false)
  })

  /**
   * Every frame of a drag is a batch of changes. A new set each time would rebuild the whole
   * node list for nothing — and rebuilding is exactly what costs a measurement.
   */
  it('hands the very same set back when the selection did not move', () => {
    const selected = new Set(['text1'])
    const changes: NodeChange[] = [
      { type: 'position', id: 'text1', position: { x: 1, y: 1 }, dragging: true },
    ]

    expect(selectionAfter(selected, changes)).toBe(selected)
  })
})
