import { EMPTY_SEQUENCE, type SequenceState } from '@/engines/timeline/timelineState'
import { installIn } from './document-fixtures'
import { sequenceStore } from './sequences'

/**
 * Puts a sequence document in front of a panel under test, in a store put back as it was built.
 */
export function installSequence(documentId: string, state: SequenceState = EMPTY_SEQUENCE): void {
  installIn(sequenceStore, documentId, state, 'video')
}
