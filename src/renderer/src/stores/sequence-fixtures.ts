import { useDocuments } from './documents'
import { useSequences } from './sequences'

/**
 * Puts a sequence document in front of a panel under test, history cleared. It declares the
 * descriptor too: the montage panels resolve their document through `activeIdOfKind`, so an id
 * with no descriptor behind it reads as "nothing open".
 *
 * Mirrors `installScene` and `installCanvas`.
 */
export function installSequence(documentId: string): void {
  useSequences.setState({ states: {}, histories: {} })
  useDocuments.setState({
    documents: {
      [documentId]: { id: documentId, kind: 'sequence', workspace: 'video', title: documentId },
    },
    activeId: documentId,
  })
}
