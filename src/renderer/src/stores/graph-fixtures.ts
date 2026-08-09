import { EMPTY_GRAPH, type GraphState } from '@shared/domain/graph'
import { installDocument } from './document-fixtures'
import { useGraphs } from './graphs'

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
