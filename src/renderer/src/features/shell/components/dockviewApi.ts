import type { DocumentDescriptor } from '@shared/domain/document'
import type { WorkspaceId } from '@shared/domain/workspace'
import type { DockviewApi } from 'dockview-react'
import { frontDocumentIn, useDocuments } from '@/stores/documents'
import { homeIsVisible, useLayouts } from '@/stores/layouts'
import { noteOpenedDocument } from '../recentDocuments'

// In its own file rather than beside `DocumentArea`: a space reaching for `setDocumentTitle`
// would otherwise import the module that imports every space.

// Module-level rather than a context: this is a handle on a layout engine, not state anything
// re-renders on — and a space reaches for it from inside the panel Dockview owns.
let current: DockviewApi | null = null

/** A tab to bring forward once the centre reports itself — see `showWorkspace`. */
let pendingFocus: string | null = null

/**
 * Called by `DocumentArea` once Dockview is ready — and again whenever the home gives it back.
 *
 * Rebuilt from the STORE, never from a queue: the home tears Dockview down, and a queue the first
 * instance drained left every later one — and the document waiting in it — with nothing.
 */
export function setDockviewApi(api: DockviewApi): void {
  current = api

  const { documents, activeId } = useDocuments.getState()
  for (const document of Object.values(documents)) ensurePanel(api, document)

  const focus = pendingFocus ?? activeId
  pendingFocus = null
  if (focus !== null) api.getPanel(focus)?.api.setActive()
}

/** Adds the tab if missing, and says nothing about the front — what rebuilding a centre needs. */
function ensurePanel(api: DockviewApi, document: DocumentDescriptor): void {
  // Dockview refuses a second panel under the same id outright.
  if (api.getPanel(document.id)) return

  api.addPanel({
    id: document.id,
    component: document.kind,
    title: document.title,
    params: { documentId: document.id },
  })
}

/** Adds it, or brings the tab already there forward. A new panel arrives in front on its own. */
function showPanel(api: DockviewApi, document: DocumentDescriptor): void {
  const existing = api.getPanel(document.id)
  if (existing) existing.api.setActive()
  else ensurePanel(api, document)
}

/**
 * Opens a document as a tab of the one centre, whichever section it belongs to, and puts that
 * section up around it.
 *
 * The descriptor is taken in first: a panel whose document the window has never heard of renders
 * "no longer open", which is what a row of the Explorer would otherwise produce.
 *
 * The section is set HERE and not left to Dockview announcing the new tab, though it does: a
 * document opened behind the home is announced a commit later, and until then the docks would be
 * those of the section the user is leaving. Behind the home only the FOCUS is carried across:
 * `setActiveWorkspace` brings the centre back, and it rebuilds its tabs from the store.
 */
export function openDocument(document: DocumentDescriptor): void {
  useDocuments.getState().adopt(document)
  // Every deliberate opening passes here and a layout restore does not, which is exactly the
  // line the shelf of recent documents has to be written on.
  void noteOpenedDocument(document)

  if (!homeIsVisible() && current) showPanel(current, document)
  else pendingFocus = document.id

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
