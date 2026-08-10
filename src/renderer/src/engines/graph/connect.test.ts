import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH, type GraphNode, type GraphState } from '@shared/domain/graph'
import type { FieldDescriptor } from '@shared/domain/model'
import { canConnect, canDropConnection, edgeOf, refuseConnection } from './connect'
import { createModelNode, createNode } from './factory'
import { outputHandlesOf } from './handles'

const asset = (id: string, type: string): GraphNode => ({
  id,
  type: 'asset',
  position: { x: 0, y: 0 },
  data: { outputHandles: [{ id: `${id}-target-image`, name: 'output', type }] },
})

const generator: GraphNode = {
  id: 'imageGenerator1',
  type: 'model',
  position: { x: 400, y: 0 },
  data: {
    inputHandles: [
      { id: 'imageGenerator1-source-referenceImages', name: 'referenceImages', type: 'image' },
      { id: 'imageGenerator1-source-prompt', name: 'prompt', type: ['prompt', 'text'] },
    ],
  },
}

const graph: GraphState = {
  nodes: [asset('image1', 'image'), asset('sound1', 'audio'), generator],
  edges: [],
  inputKeys: [],
}

/** The consumer is `source`, the provider is `target` — the inverted convention, everywhere. */
const feeding = {
  source: 'imageGenerator1',
  sourceHandle: 'imageGenerator1-source-referenceImages',
  target: 'image1',
  targetHandle: 'image1-target-image',
}

describe('what the canvas may connect', () => {
  it('joins an image output to an image input', () => {
    expect(refuseConnection(graph, feeding)).toBeNull()
    expect(canConnect(graph, feeding)).toBe(true)
  })

  it('refuses an output whose type the input does not accept', () => {
    const mismatched = { ...feeding, target: 'sound1', targetHandle: 'sound1-target-image' }

    expect(refuseConnection(graph, mismatched)).toBe('type-mismatch')
  })

  it('joins an output to a polymorphic input that names its type', () => {
    const text: GraphNode = {
      id: 'text1',
      type: 'text',
      position: { x: 0, y: 200 },
      data: { outputHandles: [{ id: 'text1-target-prompt', type: 'prompt' }] },
    }

    const withText = { ...graph, nodes: [...graph.nodes, text] }
    expect(
      refuseConnection(withText, {
        source: 'imageGenerator1',
        sourceHandle: 'imageGenerator1-source-prompt',
        target: 'text1',
        targetHandle: 'text1-target-prompt',
      }),
    ).toBeNull()
  })

  it('refuses a node wired to itself', () => {
    expect(refuseConnection(graph, { ...feeding, target: 'imageGenerator1' })).toBe('same-node')
  })

  it('refuses a connection naming a node or a port that is not there', () => {
    expect(refuseConnection(graph, { ...feeding, target: 'nowhere1' })).toBe('unknown-node')
    expect(refuseConnection(graph, { ...feeding, targetHandle: 'image1-target-nowhere' })).toBe(
      'unknown-handle',
    )
  })

  it('refuses a connection the canvas hands over without its handles', () => {
    expect(refuseConnection(graph, { ...feeding, sourceHandle: null })).toBe('unknown-handle')
  })

  /**
   * One producer per input: a second one leaves the compiler to pick, and it picks the first.
   * Refused while the wire is dragged; dropping it anyway replaces the edge — see `connect`.
   */
  it('says an input already has a producer rather than adding a second', () => {
    const wired: GraphState = {
      ...graph,
      edges: [
        {
          id: 'image1-target-image--TO--imageGenerator1-source-referenceImages',
          source: 'imageGenerator1',
          sourceHandle: 'imageGenerator1-source-referenceImages',
          target: 'sound1',
          targetHandle: 'sound1-target-image',
        },
      ],
    }

    expect(refuseConnection(wired, feeding)).toBe('input-taken')
  })

  it('names an edge that already exists rather than doubling it', () => {
    const wired: GraphState = { ...graph, edges: [edgeOf(feeding)!] }

    expect(refuseConnection(wired, feeding)).toBe('already-connected')
  })
})

/**
 * The canvas asks this one before it will so much as call `onConnect`, so it has to say yes
 * where `canConnect` says no: rewiring an input is a drop the editor answers by replacing the
 * edge. Answered with `canConnect`, the wire sprang back and nothing could ever be rewired.
 */
describe('what the canvas may drop', () => {
  const wired: GraphState = {
    ...graph,
    edges: [
      {
        id: 'sound1-target-image--TO--imageGenerator1-source-referenceImages',
        source: 'imageGenerator1',
        sourceHandle: 'imageGenerator1-source-referenceImages',
        target: 'sound1',
        targetHandle: 'sound1-target-image',
      },
    ],
  }

  it('accepts a drop onto an input that already has a producer', () => {
    expect(canConnect(wired, feeding)).toBe(false)
    expect(canDropConnection(wired, feeding)).toBe(true)
  })

  it('still refuses everything the editor cannot make sense of', () => {
    const mismatched = { ...feeding, target: 'sound1', targetHandle: 'sound1-target-image' }

    expect(canDropConnection(graph, mismatched)).toBe(false)
    expect(canDropConnection(graph, { ...feeding, target: 'imageGenerator1' })).toBe(false)
    expect(canDropConnection(graph, { ...feeding, target: 'nowhere1' })).toBe(false)
  })
})

/**
 * The gesture the graph space exists for, played on the nodes the studio REALLY builds.
 *
 * Every other suite here writes its own handles — the generator above even gives its prompt port
 * `['prompt', 'text']`, which `modelPorts` never produces. That is how a refusal survived three
 * lots: nothing was ever asked of `createNode` and `createModelNode` themselves. Asking them is
 * the whole point of this one, and it is why it does not take a shortcut through a fixture.
 */
describe('the connection the studio is for, made of what the studio builds', () => {
  const promptField: FieldDescriptor = {
    key: 'prompt',
    kind: 'text',
    label: 'Prompt',
    required: true,
    promptSpark: true,
  }

  const drawn = (): { graph: GraphState; text: GraphNode; generator: GraphNode } => {
    const text = createNode(EMPTY_GRAPH, 'text', { x: 0, y: 0 })
    const withText: GraphState = { ...EMPTY_GRAPH, nodes: [text] }
    const generator = createModelNode(withText, 'image', 'model_flux', [promptField], {
      x: 400,
      y: 0,
    })

    return { graph: { ...EMPTY_GRAPH, nodes: [text, generator] }, text, generator }
  }

  it('lets a text node feed the prompt port of a generator', () => {
    const { graph, text, generator } = drawn()
    const output = outputHandlesOf(text)[0]

    expect(
      refuseConnection(graph, {
        source: generator.id,
        sourceHandle: `${generator.id}-source-prompt`,
        target: text.id,
        targetHandle: output?.id,
      }),
    ).toBeNull()
  })

  /**
   * The two spellings that made the refusal invisible, pinned: the field of the id is `prompt`
   * while the type is `text`, and a fixture writing either the other way round tests a node
   * nobody can draw.
   */
  it('types that output text and names its port prompt, which are not the same thing', () => {
    const { text, generator } = drawn()

    expect(outputHandlesOf(text)[0]).toMatchObject({
      id: `${text.id}-target-prompt`,
      name: 'output',
      type: 'text',
    })
    expect(generator.data.inputHandles).toContainEqual(
      expect.objectContaining({ id: `${generator.id}-source-prompt`, type: 'prompt' }),
    )
  })
})

describe('the edge a connection becomes', () => {
  it('keeps the inverted convention and Scenario’s own id', () => {
    expect(edgeOf(feeding)).toEqual({
      id: 'image1-target-image--TO--imageGenerator1-source-referenceImages',
      source: 'imageGenerator1',
      sourceHandle: 'imageGenerator1-source-referenceImages',
      target: 'image1',
      targetHandle: 'image1-target-image',
    })
  })

  it('makes no edge out of a connection with no handles', () => {
    expect(edgeOf({ ...feeding, targetHandle: null })).toBeNull()
  })
})
