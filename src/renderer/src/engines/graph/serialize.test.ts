import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH, type GraphState } from '@shared/domain/graph'
import { parseGraph } from './serialize'

/** Trimmed from `wflow_coloring-page-maker`, read off the API on 9 August 2026. */
const REAL = {
  nodes: [
    {
      id: 'image1',
      type: 'asset',
      position: { x: 40, y: 336 },
      measured: { width: 363, height: 363 },
      selected: false,
      draggable: true,
      data: {
        isInput: true,
        title: 'Reference Image',
        type: 'image',
        value: 'asset_HrUhyduGcsJywgjTGy2a2P6y',
        group: '7c05d4cb-6870-4e6d-a3c1-a3650474ae60',
        inputHandles: [
          { id: 'image1-source-conditional', type: 'conditional', label: 'Is Active' },
        ],
        outputHandles: [{ id: 'image1-target-image', name: 'output', type: 'image' }],
      },
    },
    {
      id: 'imageGenerator1',
      type: 'model',
      position: { x: 500, y: 0 },
      dragging: false,
      data: { modelId: 'model_openai-gpt-image-2', isOutput: true, form: { prompt: '' } },
    },
  ],
  edges: [
    {
      id: 'image1-target-image--TO--imageGenerator1-source-referenceImages',
      source: 'imageGenerator1',
      target: 'image1',
      sourceHandle: 'imageGenerator1-source-referenceImages',
      targetHandle: 'image1-target-image',
      selected: false,
      type: 'default',
    },
  ],
  inputKeys: ['image1'],
  nodeGroups: {
    '7c05d4cb-6870-4e6d-a3c1-a3650474ae60': { title: 'Inputs', color: '#3B82F6' },
  },
}

describe('reading a graph back', () => {
  it('reads what Scenario itself writes, groups included', () => {
    const graph = parseGraph(REAL)

    expect(graph.nodes.map(node => node.id)).toEqual(['image1', 'imageGenerator1'])
    expect(graph.edges).toHaveLength(1)
    expect(graph.inputKeys).toEqual(['image1'])
    expect(graph.nodeGroups?.['7c05d4cb-6870-4e6d-a3c1-a3650474ae60']?.title).toBe('Inputs')
  })

  /** The edge convention has to survive the round trip, or every export is reversed in silence. */
  it('keeps the consumer as source and the provider as target', () => {
    const edge = parseGraph(REAL).edges[0]

    expect(edge?.source).toBe('imageGenerator1')
    expect(edge?.target).toBe('image1')
  })

  it('reads a graph back identical to the one it wrote', () => {
    const graph: GraphState = parseGraph(REAL)

    expect(parseGraph(JSON.parse(JSON.stringify(graph)))).toEqual(graph)
  })

  /**
   * A node drawn at NaN cannot be clicked, and `fitView` collapses the whole viewport onto that
   * unreachable point. Dropping the node beats an editor that opens onto nothing.
   */
  it('drops a node whose position could not be drawn', () => {
    const broken = { nodes: [{ id: 'a', type: 'text', position: { x: 0, y: 'far' }, data: {} }] }

    expect(parseGraph(broken).nodes).toEqual([])
  })

  it('drops a node whose type it has never heard of', () => {
    const broken = { nodes: [{ id: 'a', type: 'sorcery', position: { x: 0, y: 0 }, data: {} }] }

    expect(parseGraph(broken).nodes).toEqual([])
  })

  /** An edge to a node that was dropped names something that is not there any more. */
  it('drops an edge whose ends did not survive the read', () => {
    const orphaned = {
      nodes: [{ id: 'text1', type: 'text', position: { x: 0, y: 0 }, data: {} }],
      edges: [{ id: 'e', source: 'text1', target: 'gone1' }],
      inputKeys: ['text1', 'gone1'],
    }

    const graph = parseGraph(orphaned)
    expect(graph.edges).toEqual([])
    expect(graph.inputKeys).toEqual(['text1'])
  })

  /**
   * Every mutation matches by id: two nodes called `text1` would be moved together, edited
   * together and deleted together, by a gesture aimed at one of them.
   */
  it('keeps the first of two nodes that claim the same id', () => {
    const twins = {
      nodes: [
        { id: 'text1', type: 'text', position: { x: 0, y: 0 }, data: { value: 'first' } },
        { id: 'text1', type: 'text', position: { x: 9, y: 9 }, data: { value: 'second' } },
      ],
    }

    const nodes = parseGraph(twins).nodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.position).toEqual({ x: 0, y: 0 })
  })

  /** One producer per input is what the whole editor is written around — including its reader. */
  it('keeps the first of two edges feeding the same input', () => {
    const doubled = {
      nodes: [
        { id: 'text1', type: 'text', position: { x: 0, y: 0 }, data: {} },
        { id: 'text2', type: 'text', position: { x: 0, y: 9 }, data: {} },
        { id: 'model1', type: 'model', position: { x: 9, y: 0 }, data: {} },
      ],
      edges: [
        { id: 'a', source: 'model1', sourceHandle: 'model1-source-prompt', target: 'text1' },
        { id: 'b', source: 'model1', sourceHandle: 'model1-source-prompt', target: 'text2' },
      ],
    }

    const edges = parseGraph(doubled).edges
    expect(edges).toHaveLength(1)
    expect(edges[0]?.target).toBe('text1')
  })

  /**
   * `workflow` names the inputs of the workflow itself in a reference, and the validator does
   * not check it against node ids: a node called that steals every reference to them, silently.
   */
  it('refuses a node that took the one reserved id', () => {
    const usurper = {
      nodes: [{ id: 'workflow', type: 'text', position: { x: 0, y: 0 }, data: {} }],
    }

    expect(parseGraph(usurper).nodes).toEqual([])
  })

  it('reads anything that is not a graph at all as an empty one', () => {
    expect(parseGraph(null)).toEqual(EMPTY_GRAPH)
    expect(parseGraph('a graph')).toEqual(EMPTY_GRAPH)
    expect(parseGraph({})).toEqual(EMPTY_GRAPH)
  })

  // React Flow writes these onto the very objects it is handed; none of them is graph state.
  it('leaves the session fields React Flow adds out of what it reads', () => {
    const node = parseGraph(REAL).nodes[0]

    expect(node).not.toHaveProperty('selected')
    expect(node).not.toHaveProperty('measured')
    expect(node).not.toHaveProperty('draggable')
  })
})
