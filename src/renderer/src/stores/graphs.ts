import { EMPTY_GRAPH, nodeById, type GraphNode, type GraphState } from '@shared/domain/graph'
import { createDocumentStore, type DocumentStoreState } from './document-store'

/** One graph per document, with its own history — the same store the five other spaces use. */
const store = createDocumentStore<GraphState>(EMPTY_GRAPH)

export const graphStore = store
export const useGraphs = store.use
export const graphOf = store.stateOf
export const historyOf = store.historyOf

/**
 * One node of one document, in the shape a subscribed selector takes it.
 *
 * Here rather than beside the fixtures that first spelled it: a shipped file may not reach a
 * `-fixtures` module (`main/import-cycles.test.ts`), so the panel was writing this body out by
 * hand while the identical one sat on the other side of that wall.
 *
 * `null` covers three accidents at once — a document the store never held, an id the graph does
 * not hold, and no id at all. None is worth telling apart here: all three mean nothing to
 * inspect, and `undefined` is what indexing a selection yields under `noUncheckedIndexedAccess`.
 */
export const nodeIn = (
  state: DocumentStoreState<GraphState>,
  documentId: string,
  id: string | undefined,
): GraphNode | null => nodeById(graphOf(state, documentId), id)
