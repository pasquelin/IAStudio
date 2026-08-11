import { EMPTY_GRAPH, type GraphEdge, type GraphNode, type GraphState } from '@shared/domain/graph'
import { installDocument } from './document-fixtures'
import { graphOf, nodeIn, useGraphs } from './graphs'

/**
 * Puts a graph document in front of a panel under test, history cleared.
 *
 * Lives beside the stores rather than beside `textNode` for the reason `installCanvas` does:
 * `engines/` must not reach for a store.
 */
export function installGraph(documentId: string, state: GraphState = EMPTY_GRAPH): void {
  useGraphs.setState({ states: { [documentId]: state }, histories: {}, saved: {} })
  installDocument(documentId, 'graph')
}

/**
 * The reading half of `installGraph`, for what a suite asserts BETWEEN renders, where there is no
 * state to be handed. `nodeIn` itself ships from `./graphs` — a panel reads it too.
 *
 * `null` covers two different accidents — a node the graph does not hold, and a document the
 * store lost. `installGraph` REPLACES the whole map, so installing a second graph turns the
 * first into the second accident silently.
 */
export const nodeNow = (documentId: string, id: string): GraphNode | null =>
  nodeIn(useGraphs.getState(), documentId, id)

/**
 * The wires the graph is left holding, in order — what a suite names to say WHICH one survived an
 * edit. Asked of the empty list instead, an assertion holds just as well when the edit cut the lot.
 *
 * Whole edges rather than their ids: `edgeId` is spelled from the two HANDLES, so it is the one
 * field an edge keeps when its two ends are swapped — the very accident these suites watch for.
 * The empty list covers a document the store lost as much as one with no wires, for the reason
 * `nodeNow` answers `null` twice over.
 */
export const edgesNow = (documentId: string): readonly GraphEdge[] =>
  graphOf(useGraphs.getState(), documentId).edges
