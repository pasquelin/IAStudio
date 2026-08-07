import { createDocumentStore } from './document-store'
import { EMPTY_SEQUENCE, type SequenceState } from '@/engines/timeline/timeline-state'

/** One sequence per document, in memory like the documents themselves. */
const store = createDocumentStore<SequenceState>(EMPTY_SEQUENCE)

export const useSequences = store.use
export const sequenceOf = store.stateOf
export const historyOf = store.historyOf
