import { describe, expect, it } from 'vitest'
import type { GraphNode } from '@shared/domain/graph'
import {
  acceptedTypes,
  DEFAULT_OUTPUT_NAME,
  edgeId,
  handleId,
  inputHandleOf,
  inputHandlesOf,
  loopOutputId,
  outputHandleOf,
  typesConnect,
} from './handles'

type TextNode = Extract<GraphNode, { type: 'text' }>

const node = (data: TextNode['data']): TextNode => ({
  id: 'text1',
  type: 'text',
  position: { x: 0, y: 0 },
  data,
})

describe('the names Scenario reads', () => {
  /**
   * The converter matches these literally — it builds `${nodeId}-source-items` to find a port —
   * so a handle spelled any other way is a port the compiler cannot see.
   */
  it('spells a handle the way the converter looks it up', () => {
    expect(handleId('imageGenerator1', 'source', 'prompt')).toBe('imageGenerator1-source-prompt')
    expect(handleId('image1', 'target', 'image')).toBe('image1-target-image')
  })

  it('numbers a loop output the way the converter parses it', () => {
    expect(loopOutputId('forEach1', 0)).toBe('forEach1-output-0')
    expect(/-output-(\d+)$/.exec(loopOutputId('forEach1', 12))?.[1]).toBe('12')
  })

  // Observed on a published App: the output handle, then the input handle, in that order.
  it('spells an edge id the way the webapp writes it', () => {
    expect(edgeId('image1-target-image', 'imageGenerator1-source-referenceImages')).toBe(
      'image1-target-image--TO--imageGenerator1-source-referenceImages',
    )
  })

  it('names an unnamed output the way the converter defaults it', () => {
    expect(DEFAULT_OUTPUT_NAME).toBe('output')
  })
})

describe('what a port accepts', () => {
  it('reads a single type as a list of one', () => {
    expect(acceptedTypes({ id: 'a', type: 'image' })).toEqual(['image'])
  })

  /** A list is a polymorphic port — the matter of the connection check and of the port colours. */
  it('reads a polymorphic port as every type it names', () => {
    expect(acceptedTypes({ id: 'a', type: ['image', 'video'] })).toEqual(['image', 'video'])
  })

  it('reads a port that says nothing as accepting anything', () => {
    expect(acceptedTypes({ id: 'a' })).toEqual([])
  })
})

describe('whether an output can feed an input', () => {
  it('joins two ports of the same type', () => {
    expect(typesConnect({ id: 'o', type: 'image' }, { id: 'i', type: 'image' })).toBe(true)
  })

  it('refuses two ports that name different types', () => {
    expect(typesConnect({ id: 'o', type: 'image' }, { id: 'i', type: 'prompt' })).toBe(false)
  })

  it('joins a polymorphic port to any of the types it names', () => {
    const input = { id: 'i', type: ['image', 'video'] }
    expect(typesConnect({ id: 'o', type: 'video' }, input)).toBe(true)
    expect(typesConnect({ id: 'o', type: 'audio' }, input)).toBe(false)
  })

  /**
   * Scenario leaves the type off wherever it does not narrow. Refusing on silence would make a
   * graph imported from the webapp unwireable in the studio — a refusal it would never show.
   */
  it('joins when either side says nothing about its type', () => {
    expect(typesConnect({ id: 'o' }, { id: 'i', type: 'image' })).toBe(true)
    expect(typesConnect({ id: 'o', type: 'image' }, { id: 'i' })).toBe(true)
  })

  /**
   * The two pairs a published App is wired by, replayed — `wflow_H1bKz78jgpinWPKJfVCM5uAp`, 94
   * edges, `image` → `image` 69 times and `text` → `prompt` 25. The second was refused here until
   * the webapp was asked, which made the one gesture the graph space exists for impossible.
   */
  it('joins the two pairs a published App is actually wired by', () => {
    expect(typesConnect({ id: 'o', type: 'image' }, { id: 'i', type: 'image' })).toBe(true)
    expect(typesConnect({ id: 'o', type: 'text' }, { id: 'i', type: 'prompt' })).toBe(true)
  })

  /** Widened one way only: a prompt is text, a text field is not somewhere to drop a picture. */
  it('does not widen the pair the other way round', () => {
    expect(typesConnect({ id: 'o', type: 'prompt' }, { id: 'i', type: 'text' })).toBe(false)
    expect(typesConnect({ id: 'o', type: 'image' }, { id: 'i', type: 'prompt' })).toBe(false)
  })
})

describe('the ports of a node', () => {
  /** A sub-handle is a port like any other: unlisted, a model's grouped inputs cannot be wired. */
  it('reads the ports nested under a port', () => {
    const nested = node({
      inputHandles: [
        {
          id: 'text1-source-a',
          subHandles: [{ id: 'text1-source-a-1' }, { id: 'text1-source-a-2' }],
        },
      ],
    })

    expect(inputHandlesOf(nested).map(handle => handle.id)).toEqual([
      'text1-source-a',
      'text1-source-a-1',
      'text1-source-a-2',
    ])
  })

  it('finds a port by its id, nested or not', () => {
    const nested = node({
      inputHandles: [{ id: 'text1-source-a', subHandles: [{ id: 'text1-source-a-1' }] }],
      outputHandles: [{ id: 'text1-target-output' }],
    })

    expect(inputHandleOf(nested, 'text1-source-a-1')?.id).toBe('text1-source-a-1')
    expect(outputHandleOf(nested, 'text1-target-output')?.id).toBe('text1-target-output')
    expect(inputHandleOf(nested, 'nowhere')).toBeUndefined()
  })

  it('reads a node with no ports at all as having none', () => {
    expect(inputHandlesOf(node({}))).toEqual([])
  })
})
