import type { DocumentDescriptor } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import type { DockviewApi } from 'dockview-react'
import { frontDocumentIn, useDocuments } from '@/stores/documents'
import { homeIsVisible, useLayouts } from '@/stores/layouts'

// In its own file rather than beside `DocumentArea`: a space reaching for `setDocumentTitle`
// would otherwise import the module that imports every space.

// Module-level rather than a context: this is a handle on a layout engine, not state anything
// re-renders on — and a space reaches for it from inside the panel Dockview owns.
let current: DockviewApi | null = null

/**
 * Documents asked for while the centre was not on screen.
 *
 * The home COVERS the centre — `Shell` renders one or the other — so a document opened from a
 * home panel arrives while Dockview is unmounted and its api, if one was ever handed over,
 * belongs to a torn-down instance. Added there, the panel silently never opens.
 */
let pending: DocumentDescriptor[] = []

/** A tab to bring forward once the centre reports itself — see `showWorkspace`. */
let pendingFocus: string | null = null

/** Called by `DocumentArea` once Dockview is ready — and again whenever the home gives it back. */
export function setDockviewApi(api: DockviewApi): void {
  current = api

  const queued = pending
  pending = []
  for (const document of queued) addPanel(api, document)

  const focus = pendingFocus
  pendingFocus = null
  // After the queue: a document being added is a tab of its own, and it must not steal the
  // front from the one the section was chosen for.
  if (focus !== null) api.getPanel(focus)?.api.setActive()
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
 * Opens a document as a tab of the one centre, whichever section it belongs to, and puts that
 * section up around it.
 *
 * The descriptor is taken in first: a panel whose document the window has never heard of renders
 * "no longer open", which is what a row of the Explorer would otherwise produce.
 *
 * The section is set HERE and not left to Dockview announcing the new tab, though it does: a
 * document queued behind the home is announced a commit later, and until then the docks would be
 * those of the section the user is leaving. `setActiveWorkspace` also leaves the home, which is
 * what mounts the centre and drains that queue — so the read below happens before it.
 */
export function openDocument(document: DocumentDescriptor): void {
  useDocuments.getState().adopt(document)

  if (!homeIsVisible() && current) addPanel(current, document)
  else pending.push(document)

  useLayouts.getState().setActiveWorkspace(document.workspace)
}

/**
 * Brings a section forward, and with it the tab of that section the user was last in.
 *
 * The two halves of one gesture: the section drives the DOCKS — outliner, inspector, generator —
 * while the centre holds every section's tabs at once. Choosing "3D" with an image in front
 * would otherwise leave the rail and the tab strip saying different things.
 *
 * Silent when the section has no tab open: the docks still change, and a centre emptied of the
 * document the user was reading would be a worse answer than leaving it alone.
 */
export function showWorkspace(workspace: WorkspaceId): void {
  // Read BEFORE the switch: `setActiveWorkspace` leaves the home, and the answer would then be
  // about the studio this call is on its way to mounting.
  const covered = homeIsVisible()
  useLayouts.getState().setActiveWorkspace(workspace)

  const id = frontDocumentIn(useDocuments.getState(), workspace)
  if (id === null) return

  if (covered || !current) pendingFocus = id
  else current.getPanel(id)?.api.setActive()
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
