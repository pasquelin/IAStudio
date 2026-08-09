import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH, type GraphNode, type GraphState } from '@shared/domain/graph'
import { edgeOf } from './connect'
import {
  addNode,
  connect,
  consumersOf,
  disconnect,
  isReservedNodeId,
  moveNode,
  nextNodeId,
  providersOf,
  removeNode,
  updateNodeData,
} from './mutations'

const text = (id: string): GraphNode => ({
  id,
  type: 'text',
  position: { x: 0, y: 0 },
  data: { outputHandles: [{ id: `${id}-target-output`, type: 'prompt' }] },
})

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
  targetHandle: 'text1-target-output',
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
