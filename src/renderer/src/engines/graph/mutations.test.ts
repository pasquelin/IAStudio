import { describe, expect, it } from 'vitest'
import {
  CONDITIONAL_PORT,
  EMPTY_GRAPH,
  isReservedNodeId,
  nodeById,
  type GraphNode,
  type GraphState,
} from '@shared/domain/graph'
import { textNode as text, transformNode as transform } from './graph-fixtures'
import { edgeOf } from './connect'
import { handleId } from './handles'
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

  const joining = {
    source: 'transformText1',
    sourceHandle: 'transformText1-source-text',
    target: 'text1',
    targetHandle: 'text1-target-prompt',
  }

  const withTransform: GraphState = {
    ...graph,
    nodes: [...graph.nodes, text('text2'), transform('transformText1')],
  }

  /**
   * A transform names its wires after the nodes they come from, so a second one is a second CEL
   * variable rather than a contest — and dropping it must ADD, where the generator above replaces.
   */
  it('joins a second wire onto a port that takes several', () => {
    const both = connect(connect(withTransform, joining), {
      ...joining,
      target: 'text2',
      targetHandle: 'text2-target-prompt',
    })

    expect(both.edges.map(edge => edge.target)).toEqual(['text1', 'text2'])
  })

  /** Re-drawing a wire that is already there rewrites it: an edge id is its pair of handles. */
  it('does not double a wire drawn twice onto a port that takes several', () => {
    expect(connect(connect(withTransform, joining), joining).edges).toHaveLength(1)
  })

  /**
   * A wire whose CONSUMER is not in the graph — which a file read off disk carries, `planGraph`
   * filtering those very edges out. With no node to ask, the port is held to one wire.
   */
  it('adds a wire whose consumer no node answers for', () => {
    const orphaned = connect(graph, { ...wired, source: 'nowhere1' })

    expect(orphaned.edges.map(edge => edge.source)).toEqual(['nowhere1'])
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

  /**
   * A port that STEERS survives a change of model, and that is not a hole in the cut: whatever a
   * branch hands on, the condition port takes — so a new model has nothing to say about it. Read
   * as a payload type, this wire was cut in silence when the user swapped a model.
   */
  it('keeps a wire into a port that steers rather than feeds', () => {
    const steering = {
      id: handleId('imageGenerator1', 'source', CONDITIONAL_PORT),
      name: CONDITIONAL_PORT,
      type: CONDITIONAL_PORT,
    }
    // Narrowed on the type: spreading `data` off the bare union loses which arm it came from.
    const withSteering = (node: GraphNode): GraphNode =>
      node.type === 'model'
        ? {
            ...node,
            data: { ...node.data, inputHandles: [...(node.data.inputHandles ?? []), steering] },
          }
        : node

    const steered: GraphState = {
      ...fed,
      nodes: fed.nodes.map(node => (node.id === 'imageGenerator1' ? withSteering(node) : node)),
      edges: [
        ...fed.edges,
        {
          id: 'c',
          source: 'imageGenerator1',
          sourceHandle: steering.id,
          target: 'text1',
          targetHandle: 'text1-target-prompt',
        },
      ],
    }

    const kept: Partial<GraphNode['data']> = {
      ...withoutMask,
      inputHandles: [...(withoutMask.inputHandles ?? []), steering],
    }

    const next = replaceNodePorts(steered, 'imageGenerator1', kept)

    expect(next.edges.map(edge => edge.id)).toEqual(['a', 'c'])
  })

  it('keeps what the new model still answers for', () => {
    const next = replaceNodePorts(fed, 'imageGenerator1', withoutMask)

    expect(nodeById(next, 'imageGenerator1')?.data).toMatchObject({
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

    expect(next.edges.map(edge => edge.id)).toEqual(['a', 'c'])
  })

  /**
   * A wire read off this node's output, the handle being what each case varies. The reader is
   * NOT among the nodes, deliberately: `stillConnects` vouches for an edge whose end no node
   * declares, and this is the only graph in the repository that asks it to.
   */
  const consumedAt = (targetHandle: string): GraphState => ({
    ...fed,
    edges: [
      ...fed.edges,
      {
        id: 'd',
        source: 'other1',
        sourceHandle: 'other1-source-image',
        target: 'imageGenerator1',
        targetHandle,
      },
    ],
  })

  /** The node feeds others too, and its output survives the swap: those edges must not be cut. */
  it('keeps an edge that reads the output the node still publishes', () => {
    const consumed = consumedAt('imageGenerator1-target-image')
    const next = replaceNodePorts(consumed, 'imageGenerator1', withoutMask)

    expect(next.edges.map(edge => edge.id)).toEqual(['a', 'd'])
  })

  /**
   * And the same port list read the other way: an output the new model dropped takes its readers
   * with it. Removing a branch from an `ifElse` patches the OUTPUTS alone, and the wire that read
   * the departed branch names a handle no node carries — refused at export, far from the gesture.
   */
  it('cuts an edge that reads an output the new model no longer publishes', () => {
    const consumed = consumedAt('imageGenerator1-target-gone')
    const next = replaceNodePorts(consumed, 'imageGenerator1', withoutMask)

    expect(next.edges.map(edge => edge.id)).toEqual(['a'])
  })

  it('hands the very same graph back when the node is not there', () => {
    expect(replaceNodePorts(fed, 'nobody', withoutMask)).toBe(fed)
  })

  /**
   * A port that SURVIVES with another type is judged too, by the very rule the canvas refuses a
   * connection with. Checked on the id alone, a model swap that keeps a port's name while
   * changing what it takes left a wire the editor would no longer draw.
   *
   * And retyping is not a reason on its own: the port next door is retyped as well, into the very
   * type its wire offers, and keeps it.
   */
  it('cuts the edge one retyped port now refuses, and keeps the one another still takes', () => {
    const retyped: Partial<GraphNode['data']> = {
      inputHandles: [
        { id: 'imageGenerator1-source-prompt', name: 'prompt', type: 'image' },
        { id: 'imageGenerator1-source-mask', name: 'mask', type: 'text' },
      ],
      outputHandles: [{ id: 'imageGenerator1-target-image', name: 'output', type: 'image' }],
    }

    const next = replaceNodePorts(fed, 'imageGenerator1', retyped)

    expect(next.edges.map(edge => edge.id)).toEqual(['b'])
  })

  /**
   * And only on a port the patch redeclared. A `.graph` read off disk may hold a wire whose types
   * this editor would refuse — `ALSO_ACCEPTED` is two lines read off one App — and an edit
   * elsewhere must not take it away on nodes nobody touched.
   */
  it('leaves a mismatched edge between two other nodes alone', () => {
    const elsewhere: GraphState = {
      ...fed,
      nodes: [
        ...fed.nodes,
        {
          id: 'other1',
          type: 'model',
          position: { x: 0, y: 0 },
          data: {
            inputHandles: [{ id: 'other1-source-mask', name: 'mask', type: 'image' }],
          },
        },
      ],
      edges: [
        {
          id: 'c',
          source: 'other1',
          sourceHandle: 'other1-source-mask',
          target: 'text1',
          targetHandle: 'text1-target-prompt',
        },
      ],
    }

    expect(
      replaceNodePorts(elsewhere, 'imageGenerator1', withoutMask).edges.map(edge => edge.id),
    ).toEqual(['c'])
  })

  /**
   * A branch gaining or losing a case rewrites its OUTPUTS and says nothing about what feeds it.
   * Judged against input handles the node never declared — which a file is free not to write —
   * every wire into it would be cut by an edit that never mentioned them.
   */
  it('leaves the side the patch does not redeclare alone', () => {
    // The node declares NO input handles, which is what makes the test discriminating: judged
    // against them, both wires into it would be cut. A node that declares its own keeps them
    // either way, so a fixture carrying handles proved nothing about the change.
    const undeclared: GraphState = {
      ...fed,
      nodes: [text('text1'), { ...generator, data: { modelId: 'model_flux' } }],
    }
    const outputsOnly: Partial<GraphNode['data']> = {
      outputHandles: [{ id: 'imageGenerator1-target-image', name: 'output', type: 'image' }],
    }

    expect(
      replaceNodePorts(undeclared, 'imageGenerator1', outputsOnly).edges.map(edge => edge.id),
    ).toEqual(['a', 'b'])
  })

  /** And the other way round, so the rule is the contract rather than the one case that needed it. */
  it('judges the inputs alone when the patch redeclares only those', () => {
    const consumed = consumedAt('imageGenerator1-target-gone')
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
