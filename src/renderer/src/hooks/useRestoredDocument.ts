import { useEffect } from 'react'
import { restoreDocument } from '@/app/document-io'

/**
 * Fills a tab from the project when a file is there, from the space's own default otherwise —
 * and it is what saving reads back, so the two never disagree about what the document holds.
 *
 * One hook rather than the same effect in each of the six spaces: it was already written six
 * times, and a space that opened without it was a space whose documents silently never loaded.
 *
 * Nothing is awaited and nothing is caught here. `restoreDocument` reports its own failures —
 * it is the side that knows a read failed — and rethrowing into a mount effect would take down
 * the window over a file that would not open.
 */
export function useRestoredDocument(documentId: string): void {
  useEffect(() => {
    void restoreDocument(documentId)
  }, [documentId])
}
