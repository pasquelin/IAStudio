import { describe, expect, it } from 'vitest'
import {
  EMPTY_GRAPH,
  isReservedNodeId,
  type GraphNode,
  type GraphState,
} from '@shared/domain/graph'
import { textNode as text } from './graph-fixtures'
import { edgeOf } from './connect'
import {
  addNode,
  connect,
  consumersOf,
  disconnect,
  moveNode,
  nextNodeId,
  providersOf,
  removeNode,
  replaceNodePorts,
  updateNodeData,
} from './mutations'

const model: GraphNode = {
  id: 'model1',
  type: 'model',
  position: { x: 300, y: 0 },
  data: { inputHandles: [{ id: 'model1-source-prompt', type: 'prompt' }] },
}

const wired = {
  source: 'model1',
  sourceHandle: 'model1-source-prompt',
  target: 'text1',
  targetHandle: 'text1-target-prompt',
}

const graph: GraphState = { nodes: [text('text1'), model], edges: [], inputKeys: [] }

describe('naming a new node', () => {
  it('numbers per type, the way the webapp does', () => {
    expect(nextNodeId([], 'text')).toBe('text1')
    expect(nextNodeId([text('text1')], 'text')).toBe('text2')
    expect(nextNodeId([text('text1')], 'asset')).toBe('asset1')
  })

  /** The number is not an index: a graph that loses `text1` gives that name back, not a third. */
  it('takes the hole a deleted node left rather than counting on', () => {
    expect(nextNodeId([text('text2')], 'text')).toBe('text1')
  })

  /**
   * `workflow` names the inputs of the workflow itself in a reference, and the validator does
   * not check it against node ids: a node called that steals every reference to them, silently.
   */
  it('knows the one id that is reserved', () => {
    expect(isReservedNodeId('workflow')).toBe(true)
    expect(isReservedNodeId('workflow1')).toBe(false)
  })
})

describe('editing the graph', () => {
  it('adds a node without touching the rest', () => {
    const added = addNode(graph, text('text2'))

    expect(added.nodes).toHaveLength(3)
    expect(graph.nodes).toHaveLength(2)
  })

  it('moves one node and leaves the others where they are', () => {
    const moved = moveNode(graph, 'text1', { x: 40, y: 80 })

    expect(moved.nodes[0]?.position).toEqual({ x: 40, y: 80 })
    expect(moved.nodes[1]?.position).toEqual({ x: 300, y: 0 })
  })

  /**
   * An edge left behind names a node that no longer exists, which the validator rejects at
   * export — far from the gesture that caused it.
   */
  it('takes the edges of a removed node with it, and its place among the inputs', () => {
    const full: GraphState = { ...connect(graph, wired), inputKeys: ['text1'] }

    const without = removeNode(full, 'text1')
    expect(without.nodes.map(node => node.id)).toEqual(['model1'])
    expect(without.edges).toEqual([])
    expect(without.inputKeys).toEqual([])
  })

  it('merges into what a node holds without moving it or changing what it is', () => {
    const edited = updateNodeData(graph, 'text1', { title: 'A prompt' })

    expect(edited.nodes[0]).toMatchObject({
      id: 'text1',
      type: 'text',
      position: { x: 0, y: 0 },
      data: { title: 'A prompt' },
    })
    expect(edited.nodes[0]?.data.outputHandles).toHaveLength(1)
  })
})

describe('wiring', () => {
  it('adds the edge a connection becomes', () => {
    expect(connect(graph, wired).edges).toEqual([edgeOf(wired)])
  })

  /** One producer per input: the second wire replaces the first rather than joining it. */
  it('replaces the producer of an input that already had one', () => {
    const first = connect(graph, wired)
    const second = connect(addNode(first, text('text2')), {
      ...wired,
      target: 'text2',
      targetHandle: 'text2-target-output',
    })

    expect(second.edges).toHaveLength(1)
    expect(second.edges[0]?.target).toBe('text2')
  })

  it('removes an edge by its id', () => {
    const one = connect(graph, wired)

    expect(disconnect(one, one.edges[0]!.id).edges).toEqual([])
    expect(disconnect(one, 'no-such-edge').edges).toHaveLength(1)
  })

  /**
   * Read both ways round, and the convention is what makes them look backwards: a node's
   * providers are the edges it is the SOURCE of.
   */
  it('reads the providers of a node and the nodes it feeds', () => {
    const one = connect(graph, wired)

    expect(providersOf(one, 'model1').map(edge => edge.target)).toEqual(['text1'])
    expect(consumersOf(one, 'text1').map(edge => edge.source)).toEqual(['model1'])
  })

  it('leaves an empty graph empty when the connection carries no handles', () => {
    expect(connect(EMPTY_GRAPH, { source: 'a', target: 'b' })).toEqual(EMPTY_GRAPH)
  })
})

/**
 * A generator's ports come from its model's own schema, so swapping the model swaps the ports —
 * and an edge aimed at one that is gone names a handle no node carries. `validateWorkflowFlow`
 * rejects that at export, far from the gesture that caused it.
 */
describe('swapping what a node is wired by', () => {
  const generator: GraphNode = {
    id: 'imageGenerator1',
    type: 'model',
    position: { x: 0, y: 0 },
    data: {
      modelId: 'model_flux',
      inputHandles: [
        { id: 'imageGenerator1-source-prompt', name: 'prompt', type: 'prompt' },
        { id: 'imageGenerator1-source-mask', name: 'mask', type: 'image' },
      ],
      outputHandles: [{ id: 'imageGenerator1-target-image', name: 'output', type: 'image' }],
    },
  }

  const fed: GraphState = {
    nodes: [text('text1'), generator],
    edges: [
      {
        id: 'a',
        source: 'imageGenerator1',
        sourceHandle: 'imageGenerator1-source-prompt',
        target: 'text1',
        targetHandle: 'text1-target-prompt',
      },
      {
        id: 'b',
        source: 'imageGenerator1',
        sourceHandle: 'imageGenerator1-source-mask',
        target: 'text1',
        targetHandle: 'text1-target-prompt',
      },
    ],
    inputKeys: [],
  }

  const withoutMask: Partial<GraphNode['data']> = {
    modelId: 'model_sdxl',
    inputHandles: [{ id: 'imageGenerator1-source-prompt', name: 'prompt', type: 'prompt' }],
    outputHandles: [{ id: 'imageGenerator1-target-image', name: 'output', type: 'image' }],
  }

  it('cuts the edge whose port the new model does not have', () => {
    const next = replaceNodePorts(fed, 'imageGenerator1', withoutMask)

    expect(next.edges.map(edge => edge.id)).toEqual(['a'])
  })

  it('keeps what the new model still answers for', () => {
    const next = replaceNodePorts(fed, 'imageGenerator1', withoutMask)

    expect(next.nodes.find(node => node.id === 'imageGenerator1')?.data).toMatchObject({
      modelId: 'model_sdxl',
    })
  })

  /** The rest of the graph is not the caller's business — and walking it would cost the lot. */
  it('leaves an edge between two other nodes alone', () => {
    const aside = { id: 'c', source: 'text1', target: 'other1' }
    const next = replaceNodePorts(
      { ...fed, edges: [...fed.edges, aside] },
      'imageGenerator1',
      withoutMask,
    )

    expect(next.edges.some(edge => edge.id === 'c')).toBe(true)
  })

  /** The node feeds others too, and its output survives the swap: those edges must not be cut. */
  it('keeps an edge that reads the output the node still publishes', () => {
    const consumed: GraphState = {
      ...fed,
      edges: [
        {
          id: 'd',
          source: 'other1',
          sourceHandle: 'other1-source-image',
          target: 'imageGenerator1',
          targetHandle: 'imageGenerator1-target-image',
        },
      ],
    }

    expect(replaceNodePorts(consumed, 'imageGenerator1', withoutMask).edges).toHaveLength(1)
  })

  it('hands the very same graph back when the node is not there', () => {
    expect(replaceNodePorts(fed, 'nobody', withoutMask)).toBe(fed)
  })

  /**
   * A branch gaining or losing a case rewrites its OUTPUTS and says nothing about what feeds it.
   * Judged against input handles the node never declared — which a file is free not to write —
   * every wire into it would be cut by an edit that never mentioned them.
   */
  it('leaves the side the patch does not redeclare alone', () => {
    const outputsOnly: Partial<GraphNode['data']> = {
      outputHandles: [{ id: 'imageGenerator1-target-image', name: 'output', type: 'image' }],
    }

    expect(
      replaceNodePorts(fed, 'imageGenerator1', outputsOnly).edges.map(edge => edge.id),
    ).toEqual(['a', 'b'])
  })

  /** And the other way round, so the rule is the contract rather than the one case that needed it. */
  it('judges the inputs alone when the patch redeclares only those', () => {
    const consumed: GraphState = {
      ...fed,
      edges: [
        ...fed.edges,
        {
          id: 'd',
          source: 'other1',
          sourceHandle: 'other1-source-image',
          target: 'imageGenerator1',
          targetHandle: 'imageGenerator1-target-gone',
        },
      ],
    }
    const inputsOnly: Partial<GraphNode['data']> = {
      inputHandles: [{ id: 'imageGenerator1-source-prompt', name: 'prompt', type: 'prompt' }],
    }

    // `b` goes, its input port having departed; `d` stays, though it reads an output no handle
    // names — the patch said nothing about the outputs.
    expect(
      replaceNodePorts(consumed, 'imageGenerator1', inputsOnly).edges.map(edge => edge.id),
    ).toEqual(['a', 'd'])
  })
})
