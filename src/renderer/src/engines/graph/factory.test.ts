import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH, GRAPH_NODE_TYPES, type GraphState } from '@shared/domain/graph'
import { addNode } from './mutations'
import { CREATABLE_NODE_TYPES, createNode } from './factory'

const at = { x: 120, y: 40 }

describe('creating a node', () => {
  it('offers only types the editor knows how to fill', () => {
    for (const type of CREATABLE_NODE_TYPES) expect(GRAPH_NODE_TYPES).toContain(type)
  })

  /**
   * A `model` node carries `{ modelId, form }` and NO handles of its own — its ports come from
   * the model's schema. Offered before the registry is wired, it would drop a node on the canvas
   * that nothing can be wired to.
   */
  it('does not offer the one type whose ports come from elsewhere', () => {
    expect(CREATABLE_NODE_TYPES).not.toContain('model')
  })

  it('drops the node where it was asked for', () => {
    expect(createNode(EMPTY_GRAPH, 'text', at).position).toEqual(at)
  })

  it('numbers per type, taking the name a deleted node gave back', () => {
    const one = createNode(EMPTY_GRAPH, 'text', at)
    expect(one.id).toBe('text1')

    const graph = addNode(EMPTY_GRAPH, one)
    expect(createNode(graph, 'text', at).id).toBe('text2')
    expect(createNode(graph, 'asset', at).id).toBe('asset1')
  })

  /**
   * Spelled exactly as `wflow_coloring-page-maker` spells it, read off the API on 9 August 2026.
   * The FIELD is not the type: a text node outputs through `-target-prompt` carrying `text`.
   * Guessed the other way round, the converter still resolves the port — it matches by id — and
   * the mismatch surfaces only as a wire the editor refuses, with no message.
   */
  it('gives a text node the output port Scenario gives it', () => {
    const node = createNode(EMPTY_GRAPH, 'text', at)

    expect(node.data.outputHandles).toEqual([
      { id: 'text1-target-prompt', name: 'output', type: 'text' },
    ])
  })

  it('gives an asset node an output of the kind it carries', () => {
    const node = createNode(EMPTY_GRAPH, 'asset', at)

    expect(node.data).toMatchObject({
      type: 'image',
      outputHandles: [{ id: 'asset1-target-image', name: 'output', type: 'image' }],
    })
  })

  /** A note is drawn on the canvas and compiles to nothing, so it produces nothing. */
  it('gives a sticky note no output, and its text under the field Scenario reads', () => {
    const node = createNode(EMPTY_GRAPH, 'stickyNote', at)

    expect(node.data.outputHandles).toBeUndefined()
    // `content`, never `value`: a note written under `value` reopens blank in both editors.
    expect(node.data).toMatchObject({ content: '' })
  })

  /**
   * Every node of the published App declares it, the sticky note included — it is the port an
   * `ifElse` steers a node by. Created without it, a node could never be made conditional
   * without being rebuilt.
   */
  it('gives every node the conditional port they all carry', () => {
    for (const type of CREATABLE_NODE_TYPES) {
      const node = createNode(EMPTY_GRAPH, type, at)

      expect(node.data.inputHandles).toEqual([
        { id: `${node.id}-source-conditional`, name: 'conditional', type: 'conditional' },
      ])
    }
  })

  it('never hands back the reserved id, whatever the graph already holds', () => {
    const graph: GraphState = { ...EMPTY_GRAPH, inputKeys: [] }

    for (const type of CREATABLE_NODE_TYPES) {
      expect(createNode(graph, type, at).id).not.toBe('workflow')
    }
  })
})
