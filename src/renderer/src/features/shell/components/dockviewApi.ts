import type { DocumentDescriptor } from '@shared/domain/document'
import type { FileView } from '@shared/domain/fileView'
import type { WorkspaceId } from '@shared/domain/workspace'
import type { DockviewApi } from 'dockview-react'
import { frontDocumentIn, useDocuments } from '@/stores/documents'
import { homeIsVisible, useLayouts } from '@/stores/layouts'
import { noteOpenedDocument } from '../recentDocuments'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'

// In its own file rather than beside `DocumentArea`: a space reaching for `setDocumentTitle`
// would otherwise import the module that imports every space.

// Module-level rather than a context: this is a handle on a layout engine, not state anything
// re-renders on — and a space reaches for it from inside the panel Dockview owns.
let current: DockviewApi | null = null

/** A tab to bring forward once the centre reports itself — see `showWorkspace`. */
let pendingFocus: string | null = null
const fileViews = new Map<string, FileView>()
const fileViewSaves = new Map<string, () => Promise<boolean>>()

/** The one spelling of a file view's panel id, so `panelIsFileView` and its makers agree. */
export const FILE_VIEW_PREFIX = 'file:'

function fileViewPanelId(path: string): string {
  return `${FILE_VIEW_PREFIX}${path}`
}

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
  for (const view of fileViews.values()) ensureFileViewPanel(api, view)

  const focus = pendingFocus ?? activeId
  pendingFocus = null
  if (focus !== null) api.getPanel(focus)?.api.setActive()
}

function ensureFileViewPanel(api: DockviewApi, view: FileView): void {
  const id = fileViewPanelId(view.path)
  if (api.getPanel(id)) return
  api.addPanel({ id, component: view.id, title: view.title, params: { path: view.path } })
}

export function openFileView(view: FileView): void {
  const id = fileViewPanelId(view.path)
  fileViews.set(id, view)
  const existing = current?.getPanel(id)
  if (existing) existing.api.setActive()
  else if (!homeIsVisible() && current) ensureFileViewPanel(current, view)
  else pendingFocus = id
  useLayouts.getState().setActiveWorkspace('code')
}

// Which of the two a tab is. The ID answers, not the registry: `fromJSON` restores a `file:`
// panel at launch while `fileViews` — module state, never persisted — is still empty, and a tab
// closed as a document there would go through the door that asks nothing.
export function panelIsFileView(id: string): boolean {
  return id.startsWith(FILE_VIEW_PREFIX)
}

// The tab ⌘W acts on, read by the router that runs the gesture and by the menu that greys its
// row. Nothing behind the home, which covers tabs rather than replacing them.
export function closableTabId(): string | null {
  const { activeId, documents } = useDocuments.getState()
  if (homeIsVisible() || activeId === null) return null
  return documents[activeId] || panelIsFileView(activeId) ? activeId : null
}

export function closeFileView(id: string): void {
  if (documentIsMarkedModified(id)) {
    void closeModifiedFileView(id).catch(error => reportFailure('document.close', id, error))
    return
  }
  finishFileViewClose(id)
}

/** The same, awaited and answered — what a run of closings needs to stop on a cancel. */
export async function closeFileViewAsking(id: string): Promise<boolean> {
  if (documentIsMarkedModified(id) && !(await settleFileView(id))) return false
  finishFileViewClose(id)
  return true
}

async function closeModifiedFileView(id: string): Promise<void> {
  if (await settleFileView(id)) finishFileViewClose(id)
}

async function settleFileView(id: string): Promise<boolean> {
  const view = fileViews.get(id)
  const bridge = getBridge()
  if (!view || !bridge) return false
  const choice = await bridge.documents.confirmClose(view.title)
  if (choice === 'cancel') return false
  if (choice === 'save' && !(await fileViewSaves.get(id)?.())) return false
  noteModified(id, false)
  return true
}

function finishFileViewClose(id: string): void {
  fileViews.delete(id)
  fileViewSaves.delete(id)
  current?.getPanel(id)?.api.close()
  noteModified(id, false)
}

/** Whether any file view holds edits — what a leaving window asks before it lets go. */
export function fileViewsHoldEdits(): boolean {
  return [...fileViews.keys()].some(id => documentIsMarkedModified(id))
}

export function registerFileViewSave(id: string, save: () => Promise<boolean>): () => void {
  fileViewSaves.set(id, save)
  return () => {
    if (fileViewSaves.get(id) === save) fileViewSaves.delete(id)
  }
}

export async function settleFileViews(): Promise<boolean> {
  for (const id of fileViews.keys()) {
    if (documentIsMarkedModified(id) && !(await settleFileView(id))) return false
  }
  for (const id of [...fileViews.keys()]) finishFileViewClose(id)
  return true
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

const markedModified = new Map<string, boolean>()
const modifiedListeners = new Set<() => void>()

function noteModified(documentId: string, next: boolean): void {
  if (markedModified.get(documentId) === next) return
  markedModified.set(documentId, next)
  for (const listener of modifiedListeners) listener()
}

/**
 * Follows what a document is called, and whether it has unsaved work. The mark lives on the
 * tab chrome rather than in the title string: a coloured asterisk cannot be a character of
 * Dockview's label, and every space that learns to save would otherwise pick its own glyph.
 */
export function setDocumentTitle(documentId: string, title: string, modified: boolean): void {
  current?.getPanel(documentId)?.setTitle(title)
  noteModified(documentId, modified)
}

export function documentIsMarkedModified(documentId: string): boolean {
  return markedModified.get(documentId) === true
}

export function subscribeDocumentModified(onChange: () => void): () => void {
  modifiedListeners.add(onChange)
  return () => {
    modifiedListeners.delete(onChange)
  }
}

/**
 * Takes the tab away. Called by `closeDocument` once the document's own bookkeeping is done —
 * never by a tab directly, which is what keeps a closed tab from leaving its state behind.
 */
export function closePanel(documentId: string): void {
  current?.getPanel(documentId)?.api.close()
  if (markedModified.delete(documentId)) {
    for (const listener of modifiedListeners) listener()
  }
}

/** The tabs of the workspace on screen, in the order they are shown. */
export function openPanelIds(): string[] {
  return (current?.panels ?? []).map(panel => panel.id)
}
