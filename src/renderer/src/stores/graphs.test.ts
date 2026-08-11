import { beforeEach, describe, expect, it } from 'vitest'
import { textNode } from '@/engines/graph/graph-fixtures'
import { installGraph } from './graph-fixtures'
import { nodeIn, useGraphs } from './graphs'

const DOCUMENT = 'graph-1'

const TEXT = textNode('text1', 'a small grey rock')
const OTHER = textNode('text2', 'a kingfisher')

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
   * A document the store never held reads as the empty graph, so this answers `null` rather than
   * reach into an absent map: it is what the inspector shows between two documents.
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

  /**
   * Two graphs have to stand at once for this to observe anything: `installGraph` REPLACES the
   * whole map, so a second install leaves ONE document behind, and a reader that ignored
   * `documentId` outright would answer this correctly. The first is put back by hand beside the
   * second — the method `graph-fixtures.test.ts` set for the same question one floor up.
   */
  it('reads the document the caller names, not the only one installed', () => {
    installGraph('graph-2', {
      nodes: [textNode('text1', 'a kingfisher')],
      edges: [],
      inputKeys: [],
    })
    useGraphs.setState(state => ({
      states: { ...state.states, [DOCUMENT]: { nodes: [TEXT, OTHER], edges: [], inputKeys: [] } },
    }))

    expect(nodeIn(useGraphs.getState(), 'graph-2', 'text1')?.data).toMatchObject({
      value: 'a kingfisher',
    })
    expect(nodeIn(useGraphs.getState(), DOCUMENT, 'text1')?.data).toMatchObject({
      value: 'a small grey rock',
    })
  })
})
