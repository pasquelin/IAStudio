import { EMPTY_GRAPH, type GraphState } from '@shared/domain/graph'
import { createDocumentStore } from './document-store'

/** One graph per document, with its own history — the same store the five other spaces use. */
const store = createDocumentStore<GraphState>(EMPTY_GRAPH)

export const graphStore = store
export const useGraphs = store.use
export const graphOf = store.stateOf
export const historyOf = store.historyOf
