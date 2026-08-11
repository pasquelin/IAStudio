import { beforeEach, describe, expect, it } from 'vitest'
import type { GraphNode } from '@shared/domain/graph'
import { installGraph } from './graph-fixtures'
import { nodeIn, useGraphs } from './graphs'

const DOCUMENT = 'graph-1'

const TEXT: GraphNode = {
  id: 'text1',
  type: 'text',
  position: { x: 0, y: 0 },
  data: { value: 'a small grey rock' },
}

const OTHER: GraphNode = {
  id: 'text2',
  type: 'text',
  position: { x: 40, y: 0 },
  data: { value: 'a kingfisher' },
}

describe('nodeIn', () => {
  beforeEach(() => {
    installGraph(DOCUMENT, { nodes: [TEXT, OTHER], edges: [], inputKeys: [] })
  })

  /** The id decides, not the position in the list — the panel asks for one node among several. */
  it('reads the node the id names, not the first the graph holds', () => {
    expect(nodeIn(useGraphs.getState(), DOCUMENT, 'text2')?.data).toMatchObject({
      value: 'a kingfisher',
    })
  })

  it('answers null for an id the graph does not hold', () => {
    expect(nodeIn(useGraphs.getState(), DOCUMENT, 'text404')).toBeNull()
  })

  /**
   * A document the store never held reads as the empty graph, so this must answer `null` rather
   * than reach into an absent map: it is what the inspector shows between two documents.
   */
  it('answers null for a document the store never held', () => {
    expect(nodeIn(useGraphs.getState(), 'graph-404', 'text1')).toBeNull()
  })

  /**
   * Indexing a selection yields `string | undefined`, and the panel hands that straight over
   * rather than talking itself out of it with a `?? ''` that no graph would ever hold anyway.
   */
  it('answers null for no id at all', () => {
    expect(nodeIn(useGraphs.getState(), DOCUMENT, undefined)).toBeNull()
  })

  /** The id is read against the document asked for, not against whichever one was installed. */
  it('reads the document the caller names', () => {
    installGraph('graph-2', { nodes: [OTHER], edges: [], inputKeys: [] })

    expect(nodeIn(useGraphs.getState(), 'graph-2', 'text1')).toBeNull()
    expect(nodeIn(useGraphs.getState(), 'graph-2', 'text2')?.id).toBe('text2')
  })
})
