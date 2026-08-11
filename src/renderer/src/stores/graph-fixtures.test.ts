import { beforeEach, describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from '@shared/domain/graph'
import { wire } from '@/engines/graph/graph-fixtures'
import { updateNodeData } from '@/engines/graph/mutations'
import { edgesNow, installGraph, nodeNow } from './graph-fixtures'
import { graphOf, useGraphs } from './graphs'

const DOCUMENT = 'graph-1'

const TEXT: GraphNode = {
  id: 'text1',
  type: 'text',
  position: { x: 0, y: 0 },
  data: { value: 'a small grey rock' },
}

const FIRST: GraphEdge = wire('model1', 'prompt', 'text1', 'prompt')
const SECOND: GraphEdge = wire('model2', 'prompt', 'text1', 'prompt')

describe('nodeNow', () => {
  beforeEach(() => {
    installGraph(DOCUMENT, { nodes: [TEXT], edges: [], inputKeys: [] })
  })

  /**
   * Two graphs have to stand at once for this to be observable: with one installed, reading the
   * wrong document finds nothing, which is what a missing node looks like too. And `installGraph`
   * REPLACES the whole map, so the first is put back beside the second by hand.
   */
  it('reads the document it is given, not one of its own', () => {
    installGraph('graph-2', {
      nodes: [{ ...TEXT, data: { value: 'a kingfisher' } }],
      edges: [],
      inputKeys: [],
    })
    useGraphs.setState(state => ({
      states: { ...state.states, [DOCUMENT]: { nodes: [TEXT], edges: [], inputKeys: [] } },
    }))

    expect(nodeNow('graph-2', 'text1')?.data).toMatchObject({ value: 'a kingfisher' })
    expect(nodeNow(DOCUMENT, 'text1')?.data).toMatchObject({ value: 'a small grey rock' })
  })

  /** What the suites branch on: `null`, never a throw, for a node the graph does not hold. */
  it('answers null for an id the graph does not hold', () => {
    expect(nodeNow(DOCUMENT, 'text2')).toBeNull()
  })

  /**
   * The same `null` for a document the store never held — the accident `installGraph` causes by
   * replacing the whole map. Pinned because it is a silent one: the store's own `EMPTY_GRAPH`
   * fallback is what keeps `nodeById` from reading `undefined.nodes` and throwing.
   */
  it('answers null for a document the store does not hold', () => {
    expect(nodeNow('graph-404', 'text1')).toBeNull()
  })

  /**
   * Read at call time, not at import time — the suites call it after an edit and expect the new
   * value. A reader that closed over the state it was defined with would pass every test above.
   */
  it('reads the store as it stands at the call, not as it stood before', () => {
    const before = nodeNow(DOCUMENT, 'text1')

    useGraphs.setState(state => ({
      states: {
        ...state.states,
        [DOCUMENT]: updateNodeData(graphOf(state, DOCUMENT), 'text1', { value: 'a kingfisher' }),
      },
    }))

    expect(before?.data).toMatchObject({ value: 'a small grey rock' })
    expect(nodeNow(DOCUMENT, 'text1')?.data).toMatchObject({ value: 'a kingfisher' })
  })
})

describe('edgesNow', () => {
  beforeEach(() => {
    installGraph(DOCUMENT, { nodes: [TEXT], edges: [FIRST, SECOND], inputKeys: [] })
  })

  /** The ORDER is the point: it is what lets a suite say which of two wires an edit left behind. */
  it('reads the wires in the order the graph holds them', () => {
    expect(edgesNow(DOCUMENT)).toEqual([FIRST, SECOND])
  })

  /**
   * WHOLE edges, and this is the reason the helper does not hand back ids: an id is spelled from
   * the two handles, so it survives a swap of the two ends that a suite exists to catch.
   */
  it('hands back the ends, not only the name they compose', () => {
    const swapped = { ...FIRST, source: FIRST.target, target: FIRST.source }

    useGraphs.setState(state => ({
      states: { ...state.states, [DOCUMENT]: { nodes: [TEXT], edges: [swapped], inputKeys: [] } },
    }))

    expect(edgesNow(DOCUMENT)).not.toEqual([FIRST])
  })

  /** The empty list for a document the store never held, as `nodeNow` answers `null` for one. */
  it('answers an empty list for a document the store does not hold', () => {
    expect(edgesNow('graph-404')).toEqual([])
  })

  /** Read at call time: a reader that closed over the graph it was defined with would miss this. */
  it('reads the store as it stands at the call, not as it stood before', () => {
    useGraphs.setState(state => ({
      states: { ...state.states, [DOCUMENT]: { nodes: [TEXT], edges: [SECOND], inputKeys: [] } },
    }))

    expect(edgesNow(DOCUMENT)).toEqual([SECOND])
  })
})
