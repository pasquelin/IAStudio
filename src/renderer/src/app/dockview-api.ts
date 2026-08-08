import type { DocumentDescriptor } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import type { DockviewApi } from 'dockview-react'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'

// In its own file rather than beside `DocumentArea`: a space reaching for `setDocumentTitle`
// would otherwise import the module that imports every space.

// Module-level rather than a context: this is a handle on a layout engine, not state anything
// re-renders on — and a space reaches for it from inside the panel Dockview owns.
let current: DockviewApi | null = null
/** Which workspace `current` belongs to: Dockview is remounted per workspace, api and all. */
let mounted: WorkspaceId | null = null

/**
 * Documents asked for while the workspace that opens them was still being mounted.
 *
 * Dockview is keyed on the workspace, so switching workspace throws its api away and builds
 * another — one React commit later. A panel added to the outgoing api would be added to a
 * layout about to be discarded, which is a document that silently never opens.
 */
let pending: DocumentDescriptor[] = []

/** Called by `DocumentArea` once Dockview is ready — and again on every workspace remount. */
export function setDockviewApi(workspace: WorkspaceId, api: DockviewApi): void {
  current = api
  mounted = workspace

  const queued: DocumentDescriptor[] = []
  const waiting: DocumentDescriptor[] = []
  for (const document of pending) {
    ;(document.workspace === workspace ? queued : waiting).push(document)
  }

  pending = waiting
  for (const document of queued) addPanel(api, document)
}

function addPanel(api: DockviewApi, document: DocumentDescriptor): void {
  // Already open: bring it forward rather than adding a second panel under the same id, which
  // Dockview refuses outright.
  const existing = api.getPanel(document.id)
  if (existing) {
    existing.api.setActive()
    return
  }

  api.addPanel({
    id: document.id,
    component: document.kind,
    title: document.title,
    params: { documentId: document.id },
  })
}

/**
 * Opens a document, switching workspace when it belongs to another one — a sequence opened from
 * the Image workspace lands in Video, the way double-clicking an asset already crosses.
 *
 * The descriptor is taken in first: a panel whose document the window has never heard of renders
 * "no longer open", which is what a row of the Explorer would otherwise produce.
 */
export function openDocument(document: DocumentDescriptor): void {
  useDocuments.getState().adopt(document)

  if (mounted === document.workspace && current) {
    addPanel(current, document)
    return
  }

  pending.push(document)
  useLayouts.getState().setActiveWorkspace(document.workspace)
}

/**
 * Follows what a document is called, and whether it has unsaved work. The bullet lives here
 * rather than in each space: the tab is the only place a document can say it is not on disk,
 * and every space that learns to save would otherwise pick its own glyph.
 */
export function setDocumentTitle(documentId: string, title: string, modified: boolean): void {
  current?.getPanel(documentId)?.setTitle(modified ? `${title} •` : title)
}

/**
 * Takes the tab away. Called by `closeDocument` once the document's own bookkeeping is done —
 * never by a tab directly, which is what keeps a closed tab from leaving its state behind.
 */
export function closePanel(documentId: string): void {
  current?.getPanel(documentId)?.api.close()
}

/** The tabs of the workspace on screen, in the order they are shown. */
export function openPanelIds(): string[] {
  return (current?.panels ?? []).map(panel => panel.id)
}
