import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GraphNode, GraphState } from '@shared/domain/graph'
import { addGraphNode, connectGraph } from '@/engines/graph/commands'
import { graphOf, useGraphs } from '@/stores/graphs'
import { GraphDocument } from './GraphDocument'

const DOCUMENT = 'graph_1'

const text: GraphNode = {
  id: 'text1',
  type: 'text',
  position: { x: 0, y: 0 },
  data: {
    value: 'a small grey rock',
    outputHandles: [{ id: 'text1-target-output', name: 'output', type: 'prompt' }],
  },
}

const model: GraphNode = {
  id: 'model1',
  type: 'model',
  position: { x: 400, y: 0 },
  data: {
    modelId: 'model_flux',
    inputHandles: [{ id: 'model1-source-prompt', label: 'Prompt', type: 'prompt' }],
  },
}

const wire = {
  source: 'model1',
  sourceHandle: 'model1-source-prompt',
  target: 'text1',
  targetHandle: 'text1-target-output',
}

const state = (): GraphState => graphOf(useGraphs.getState(), DOCUMENT)

beforeEach(() => {
  useGraphs.setState({ states: {}, histories: {}, saved: {} })
})

describe('a graph as a document', () => {
  it('draws what the store holds', () => {
    const store = useGraphs.getState()
    store.runCommand(DOCUMENT, addGraphNode(text))
    store.runCommand(DOCUMENT, addGraphNode(model))

    render(<GraphDocument documentId={DOCUMENT} />)

    expect(screen.getByText('a small grey rock')).toBeInTheDocument()
    expect(screen.getByText('model_flux')).toBeInTheDocument()
  })

  /**
   * The end of the milestone, spelled as a test: three nodes, a wire, and ⌘Z gives the wire
   * back. The undo is the shared history — no store of its own was written for the graph.
   */
  it('undoes an edge without undoing the nodes it joined', () => {
    const store = useGraphs.getState()
    store.runCommand(DOCUMENT, addGraphNode(text))
    store.runCommand(DOCUMENT, addGraphNode(model))
    store.runCommand(DOCUMENT, connectGraph(wire))

    expect(state().edges).toHaveLength(1)

    store.undo(DOCUMENT)

    expect(state().edges).toEqual([])
    expect(state().nodes).toHaveLength(2)
  })

  it('redoes what it just undid', () => {
    const store = useGraphs.getState()
    store.runCommand(DOCUMENT, addGraphNode(text))
    store.runCommand(DOCUMENT, addGraphNode(model))
    store.runCommand(DOCUMENT, connectGraph(wire))
    store.undo(DOCUMENT)
    store.redo(DOCUMENT)

    expect(state().edges).toHaveLength(1)
    expect(state().edges[0]?.source).toBe('model1')
  })

  /** A drag is one thing the user did, whatever number of frames it took. */
  it('collapses a whole drag into one undo entry', () => {
    const store = useGraphs.getState()
    store.runCommand(DOCUMENT, addGraphNode(text))

    store.beginGesture(DOCUMENT)
    store.runCommand(DOCUMENT, { id: 'graph:move:text1', apply: moveTo(10), revert: moveTo(0) })
    store.runCommand(DOCUMENT, { id: 'graph:move:text1', apply: moveTo(90), revert: moveTo(0) })
    store.endGesture(DOCUMENT)

    expect(state().nodes[0]?.position.x).toBe(90)

    store.undo(DOCUMENT)
    expect(state().nodes[0]?.position.x).toBe(0)
  })
})

const moveTo =
  (x: number) =>
  (graph: GraphState): GraphState => ({
    ...graph,
    nodes: graph.nodes.map(node => ({ ...node, position: { ...node.position, x } })),
  })
