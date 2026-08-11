import { describe, expect, it } from 'vitest'
import { EMPTY_GRAPH, nodeById, type GraphNode, type GraphState } from './graph'

const node = (id: string): GraphNode => ({
  id,
  type: 'forEach',
  position: { x: 0, y: 0 },
  data: {},
})

const graph = (...nodes: readonly GraphNode[]): GraphState => ({ ...EMPTY_GRAPH, nodes })

describe('nodeById', () => {
  it('answers with the node an id names', () => {
    expect(nodeById(graph(node('a'), node('b')), 'b')?.id).toBe('b')
  })

  // `null` and not `undefined`, so one name means one shape: `nodeById` on the scene side
  // (`engines/scene/scene-state.ts`) already answers this way, and both are read by the inspector.
  it('answers null rather than undefined when nothing carries the id', () => {
    expect(nodeById(graph(node('a')), 'b')).toBeNull()
    expect(nodeById(EMPTY_GRAPH, 'a')).toBeNull()
  })

  // A selection reads `ids[0]`, which the compiler types as possibly missing: widening the
  // signature is what keeps every caller from writing `?? ''` back.
  it('answers null for a missing id rather than refusing it', () => {
    expect(nodeById(graph(node('a')), undefined)).toBeNull()
  })
})
