import { EMPTY_SEQUENCE, type SequenceState } from '@/engines/timeline/timeline-state'
import { installDocument } from './document-fixtures'
import { useSequences } from './sequences'

/** Puts a sequence document in front of a panel under test, history cleared. */
export function installSequence(documentId: string, state: SequenceState = EMPTY_SEQUENCE): void {
  useSequences.setState({ states: { [documentId]: state }, histories: {} })
  installDocument(documentId, 'video')
}
