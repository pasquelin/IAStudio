import { useEffect, useRef } from 'react'
import type { DocumentKind } from '@shared/domain/document'
import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'

/** How long a document stays quiet before it is written. One save per pause, not per keystroke. */
const QUIET_MS = 600

export type DocumentFileOptions<S> = {
  documentId: string
  kind: DocumentKind
  /** What the editor holds right now. A new identity is what marks it as changed. */
  state: S
  /** Installs what was read back off disk. Not called when the document is new. */
  load: (content: string) => void
  serialize: (state: S) => string
}

/**
 * A document, read on open and written when it settles.
 *
 * Reading first and only then following the state: without the flag, the empty state the editor
 * starts on would be written over the file before the file had a chance to be read, and opening
 * a document would erase it.
 *
 * Debounced rather than written per change: a slider drag is a hundred states, and a document
 * of a few megabytes written a hundred times a second is a disk the user can hear.
 */
export function useDocumentFile<S>({
  documentId,
  kind,
  state,
  load,
  serialize,
}: DocumentFileOptions<S>): void {
  const ready = useRef(false)
  // Read through a ref: the callbacks are rebuilt on every render, and following them would
  // reload the document each time the pointer moves.
  const latest = useRef({ load, serialize })

  useEffect(() => {
    latest.current = { load, serialize }
  })

  useEffect(() => {
    ready.current = false
    let stale = false

    void getBridge()
      ?.documents.read(documentId, kind)
      .then(file => {
        if (stale) return
        if (file && file.content) latest.current.load(file.content)
        // Only now may a save happen: before this, the state is whatever the editor opened on.
        ready.current = true
      })
      .catch(() => {
        // Unreadable, or no project: the tab stays on what it opened with rather than saving
        // over a file it could not read.
      })

    return () => {
      stale = true
    }
  }, [documentId, kind])

  useEffect(() => {
    if (!ready.current) return

    const title = useDocuments.getState().documents[documentId]?.title
    if (title === undefined) return

    const content = latest.current.serialize(state)
    const timer = setTimeout(() => {
      void getBridge()?.documents.write(documentId, kind, { title, content })
    }, QUIET_MS)

    return () => clearTimeout(timer)
  }, [documentId, kind, state])
}
