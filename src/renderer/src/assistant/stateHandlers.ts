import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { scopeOfWorkspace } from '@shared/domain/command'
import type { DocumentDescriptor } from '@shared/domain/document'
import { EXPORT_FORMATS } from '@shared/domain/scene'
import { TEXTURE_EXPORT_TARGETS } from '@shared/domain/textureExport'
import type { FolderExportRequest } from '@shared/ipc'
import { closeDocument, documentIsDirty } from '@/app/documentIo'
import { openDocument } from '@/app/dockviewApi'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useDocuments } from '@/stores/documents'
import { toolSurface, useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { withBridge, type ActionHandlers } from './actionHandler'
import { numberOf, oneOf, textOf } from './actionInputs'

/** The face a sky is exported at when a client names none — the row the native menu offers. */
const DEFAULT_FACE = 2048

const SCENE_SCOPES: readonly ('scene' | 'selection')[] = ['scene', 'selection']

/**
 * What the studio is, read from the stores the screen reads. Nothing here computes a second
 * answer — the surface comes from `toolSurface`, the dirty mark from the predicate the tab
 * bullet uses: a client and the person at the machine must see one studio, not two.
 */

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
  // `'own-write'` rather than a bare call, which joins a listing already in flight — one that may
  // have STARTED before the file appeared, and would answer without it.
  if (!documentAt(path)) await useDocuments.getState().relist('own-write')

  const document = documentAt(path)
  if (!document) return refused('notFound')

  openDocument(document)
  return { ok: true, data: { documentId: document.id } }
}

/** The open document a call names, or nothing — every action of this family takes one by id. */
function namedDocument(input: Record<string, unknown>): DocumentDescriptor | null {
  return useDocuments.getState().documents[textOf(input, 'documentId') ?? ''] ?? null
}

function named(input: Record<string, unknown>): string | null {
  return namedDocument(input)?.id ?? null
}

async function close(input: Record<string, unknown>): Promise<ActionOutcome> {
  const documentId = named(input)
  if (documentId === null) return refused('notFound')

  /**
   * The same path the tab's cross takes, question about unsaved work included — and the reason
   * this action commits `none`: `closeDocument` raises the only question that knows whether
   * there is anything at stake, so a second one before it would ask twice for one gesture.
   */
  return (await closeDocument(documentId)) ? { ok: true } : refused('declined')
}

async function rename(input: Record<string, unknown>): Promise<ActionOutcome> {
  const documentId = named(input)
  const title = textOf(input, 'title') ?? ''
  if (documentId === null) return refused('notFound')

  const failure = await useDocuments.getState().rename(documentId, title)
  if (failure) {
    reportFailure('document.rename', title, failure)
    return refused('badInput')
  }

  return { ok: true }
}

/**
 * The files an export of the document in front comes to, one space at a time.
 *
 * Loaded on the call rather than imported at the top: this table is evaluated by the first screen,
 * and `eager-graph.test.ts` holds that chunk to reaching no third module out of an editor's
 * folder. Each of them is the SAME rendering the native menu goes through.
 *
 * A montage answers with its CUT rather than a film of it: the film is rendered frame by frame
 * through a session the viewport drives and no outside client can hold, while the `.otio` is one
 * encoding of plain data. The two audio-and-video kinds share it — they share the montage.
 *
 * **All six kinds answer now, so there is no `default`** — the compiler is what keeps a seventh
 * from being forgotten, where a fallback would have silently refused it.
 */
async function exportOf(
  document: DocumentDescriptor,
  input: Record<string, unknown>,
): Promise<FolderExportRequest> {
  switch (document.kind) {
    case 'image': {
      const { imageExportFiles } = await import('@/spaces/image/imageExportFiles')
      return imageExportFiles(document.id)
    }
    case 'scene': {
      const { sceneExportFiles } = await import('@/spaces/three/sceneExportFiles')
      return sceneExportFiles(
        document.id,
        oneOf(input, 'format', EXPORT_FORMATS) ?? 'glb',
        oneOf(input, 'scope', SCENE_SCOPES) ?? 'scene',
      )
    }
    case 'skybox': {
      const { skyboxExportFiles } = await import('@/spaces/skyboxes/skyboxExportFiles')
      return skyboxExportFiles(document.id, numberOf(input, 'size') ?? DEFAULT_FACE)
    }
    case 'texture': {
      const { textureExportFiles } = await import('@/spaces/textures/textureExportFiles')
      return textureExportFiles(
        document.id,
        oneOf(input, 'target', TEXTURE_EXPORT_TARGETS) ?? 'raw',
      )
    }
    case 'sequence':
    case 'audio': {
      const { otioExportFiles } = await import('@/app/otioExport')
      return otioExportFiles(document.id)
    }
  }
}

/**
 * Writes the document in front into the project, in a folder of its own.
 *
 * Every rendering throws rather than answering half an export — a sky with no picture, a material
 * with no channel, an engine that is not mounted, a montage with no project to resolve its media
 * against. `notRenderable` names them; this used to answer `badInput`, which sent a client back
 * to check parameters that were never the cause.
 *
 * The `try` covers the RENDERING alone. It wrapped the write too, so a `folder` the main process
 * refuses — it takes one path segment — came back named as a rendering that never happened.
 */
async function exportDocument(input: Record<string, unknown>): Promise<ActionOutcome> {
  const documents = useDocuments.getState()
  const document = documents.activeId ? documents.documents[documents.activeId] : undefined
  if (!document) return refused('wrongSurface')

  let request
  try {
    request = await exportOf(document, input)
  } catch (error) {
    reportFailure('document.export', document.id, error)
    return refused('notRenderable')
  }

  const folder = textOf(input, 'folder')
  return withBridge(bridge =>
    bridge.project.exportInto(folder === null ? request : { ...request, folder }),
  )
}

export const STATE_HANDLERS: ActionHandlers = {
  'studio.state': studioState,
  'document.export': exportDocument,
  'documents.list': listDocuments,
  'document.open': openByPath,
  'document.close': close,
  'document.rename': rename,

  // The same gesture as opening it: naming the tab in the store alone left an image in front of
  // a sky's panels, which no click can produce — the state this action exists to repair.
  'document.activate': input => {
    const document = namedDocument(input)
    if (document === null) return refused('notFound')

    // Named here as well as opened: behind the home there is no centre to announce the tab, and
    // the state a client reads next would still be describing the document it just left.
    useDocuments.getState().activate(document.id)
    openDocument(document)
    return { ok: true }
  },

  'activity.recent': input => {
    const limit = numberOf(input, 'limit')
    return withBridge(bridge => bridge.activity.read(limit === null ? {} : { limit }))
  },
}
