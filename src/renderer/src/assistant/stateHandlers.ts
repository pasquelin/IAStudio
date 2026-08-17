import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import { scopeOfWorkspace } from '@shared/domain/command'
import type { DocumentDescriptor } from '@shared/domain/document'
import { closeDocument, documentIsDirty } from '@/app/documentIo'
import { openDocument } from '@/app/dockviewApi'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useDocuments } from '@/stores/documents'
import { toolSurface, useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import type { ActionHandlers } from './actionHandler'
import { numberOf, textOf } from './actionInputs'

/**
 * What the studio is, read from the stores the screen reads.
 *
 * Nothing here computes a second answer: the surface comes from `toolSurface`, the dirty mark
 * from the same predicate the tab bullet uses. A client and the person in front of the machine
 * have to be looking at one studio, not two descriptions of one.
 */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

const summaryOf = (document: DocumentDescriptor, activeId: string | null) => ({
  id: document.id,
  title: document.title,
  kind: document.kind,
  workspace: document.workspace,
  path: document.path,
  active: document.id === activeId,
  modified: documentIsDirty(document.id),
})

async function studioState(): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const documents = useDocuments.getState()
  const surface = toolSurface()

  return {
    ok: true,
    data: {
      project: useProject.getState().project,
      workspace: useLayouts.getState().activeWorkspace,
      /**
       * The surface, and the scope it puts a command in — the two facts `command.run` refuses on.
       * A client that reads `wrongSurface` needs the SCOPE to know what to activate, and deriving
       * it here rather than leaving it to be looked up is what makes the refusal actionable.
       */
      surface,
      commandScope: scopeOfWorkspace(surface),
      documents: Object.values(documents.documents).map(one => summaryOf(one, documents.activeId)),
      armedModels: useModels.getState().selected,
      authenticated: (await bridge.settings.authState()).authenticated,
    },
  }
}

function listDocuments(): ActionOutcome {
  const { stored, documents, activeId } = useDocuments.getState()
  const open = new Set(Object.keys(documents))

  return {
    ok: true,
    // `stored` is the folder and `documents` is what tabs show; a document may be in either or
    // both, and a client asking "what is there" means the union.
    data: [
      ...stored,
      ...Object.values(documents).filter(one => !stored.some(s => s.id === one.id)),
    ].map(one => ({ ...summaryOf(one, activeId), open: open.has(one.id) })),
  }
}

function documentAt(path: string): DocumentDescriptor | null {
  const { stored, documents } = useDocuments.getState()
  return (
    stored.find(one => one.path === path) ??
    Object.values(documents).find(one => one.path === path) ??
    null
  )
}

async function openByPath(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null) return refused('badInput')

  // Re-read first: the listing a client holds may predate a file that has since arrived, and
  // answering "no such document" for one sitting on the disk is the least useful refusal there is.
  if (!documentAt(path)) await useDocuments.getState().relist()

  const document = documentAt(path)
  if (!document) return refused('badInput')

  openDocument(document)
  return { ok: true, data: { documentId: document.id } }
}

function activate(input: Record<string, unknown>): ActionOutcome {
  const documentId = textOf(input, 'documentId')
  const state = useDocuments.getState()
  if (documentId === null || !state.documents[documentId]) return refused('badInput')

  state.activate(documentId)
  return { ok: true }
}

async function close(input: Record<string, unknown>): Promise<ActionOutcome> {
  const documentId = textOf(input, 'documentId')
  if (documentId === null || !useDocuments.getState().documents[documentId]) {
    return refused('badInput')
  }

  // The same path the tab's cross takes, question about unsaved work included. A second one that
  // skipped the question would be the only way in the studio to lose work silently.
  return (await closeDocument(documentId)) ? { ok: true } : refused('declined')
}

async function rename(input: Record<string, unknown>): Promise<ActionOutcome> {
  const documentId = textOf(input, 'documentId')
  const title = textOf(input, 'title')
  if (documentId === null || title === null) return refused('badInput')
  if (!useDocuments.getState().documents[documentId]) return refused('badInput')

  const failure = await useDocuments.getState().rename(documentId, title)
  if (failure) {
    reportFailure('document.rename', title, failure)
    return refused('badInput')
  }

  return { ok: true }
}

async function recentActivity(input: Record<string, unknown>): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge')

  const limit = numberOf(input, 'limit')
  return { ok: true, data: await bridge.activity.read(limit === null ? {} : { limit }) }
}

export const STATE_HANDLERS: ActionHandlers = {
  'studio.state': studioState,
  'documents.list': listDocuments,
  'document.open': openByPath,
  'document.activate': activate,
  'document.close': close,
  'document.rename': rename,
  'activity.recent': recentActivity,
}
