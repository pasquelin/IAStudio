import type { DocumentDescriptor } from '@shared/domain/document'
import type { DockviewApi } from 'dockview-react'

// In its own file rather than beside `DocumentArea`: a space reaching for `setDocumentTitle`
// would otherwise import the module that imports every space.

// Module-level rather than a context: this is a handle on a layout engine, not state anything
// re-renders on — and a space reaches for it from inside the panel Dockview owns.
let current: DockviewApi | null = null

/** Called by `DocumentArea` once Dockview is ready — and again on every workspace remount. */
export function setDockviewApi(api: DockviewApi): void {
  current = api
}

export function openDocument(document: DocumentDescriptor): void {
  current?.addPanel({
    id: document.id,
    component: document.kind,
    title: document.title,
    params: { documentId: document.id },
  })
}

/**
 * Follows what a document is called, and whether it has unsaved work. The bullet lives here
 * rather than in each space: the tab is the only place a document can say it is not on disk,
 * and every space that learns to save would otherwise pick its own glyph.
 */
export function setDocumentTitle(documentId: string, title: string, modified: boolean): void {
  current?.getPanel(documentId)?.setTitle(modified ? `${title} •` : title)
}
