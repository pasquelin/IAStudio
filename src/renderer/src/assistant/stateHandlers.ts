import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type {
  SnapshotDocument,
  SnapshotSelection,
  StudioSnapshot,
} from '@shared/domain/studioSnapshot'
import { scopeOfWorkspace } from '@shared/domain/command'
import type { DocumentDescriptor } from '@shared/domain/document'
import { EXPORT_FORMATS } from '@shared/domain/scene'
import { TEXTURE_EXPORT_TARGETS } from '@shared/domain/textureExport'
import type { FolderExportRequest } from '@shared/ipc'
import { closeDocument, documentIsDirty, dropDocument, saveDocument } from '@/app/documentIo'
import { openDocument } from '@/app/dockviewApi'
import { layerById } from '@/engines/canvas/canvasState'
import { selectedNodes } from '@/engines/scene/sceneState'
import { designatedIn } from '@/engines/timeline/timelineState'
import { reportFailure } from '@/services/diagnostics'
import { canvasOf, canvasStore, useCanvases } from '@/stores/canvases'
import {
  activeImageId,
  activeMontageId,
  activeSceneId,
  documentAtPath,
  useDocuments,
  type DocumentsSlice,
} from '@/stores/documents'
import { toolSurface, useLayouts } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { sceneOf, sceneStore, useScenes } from '@/stores/scenes'
import { sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'
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

const summaryOf = (document: DocumentDescriptor, activeId: string | null): SnapshotDocument => ({
  id: document.id,
  title: document.title,
  kind: document.kind,
  workspace: document.workspace,
  path: document.path,
  active: document.id === activeId,
  modified: documentIsDirty(document.id),
})

function selectionNow(documents: DocumentsSlice): SnapshotSelection | null {
  const imageId = activeImageId(documents)
  if (imageId !== null) {
    /**
     * 🛑 Only once the store HOLDS this canvas. `canvasOf` answers `DEFAULT_CANVAS` for a
     * document it has not loaded, and its active layer is the base one — so a freshly opened
     * image reported "Background" as designated, and "delete it" aimed at a layer nobody chose.
     */
    const canvases = useCanvases.getState()
    if (!canvasStore.hasState(canvases, imageId)) return null

    const canvas = canvasOf(canvases, imageId)
    const layer = layerById(canvas, canvas.activeLayerId)
    return layer ? { kind: 'layer', items: [{ id: layer.id, name: layer.name }] } : null
  }

  const sceneId = activeSceneId(documents)
  if (sceneId !== null) {
    const scenes = useScenes.getState()
    if (!sceneStore.hasState(scenes, sceneId)) return null

    const scene = sceneOf(scenes, sceneId)
    // The scene's own reader, which keeps the ORDER OF SELECTION — its last node is the anchor
    // the inspector reads. Filtering the tree instead returned them in tree order, so the anchor
    // could fall outside the four this briefing names.
    const chosen = selectedNodes(scene.nodes, scene.selectedIds)
    return chosen.length === 0
      ? null
      : { kind: 'node', items: chosen.map(node => ({ id: node.id, name: node.name })) }
  }

  const montageId = activeMontageId(documents)
  if (montageId === null) return null

  const sequences = useSequences.getState()
  if (!sequenceStore.hasState(sequences, montageId)) return null

  // The one answer `InspectorFace` reads. A clip has no name of its own, so it stands under its id.
  const designated = designatedIn(sequenceOf(sequences, montageId))
  if (designated === null) return null

  const { id, name } =
    designated.kind === 'track'
      ? designated.track
      : { id: designated.clip.id, name: designated.clip.id }
  return { kind: designated.kind, items: [{ id, name }] }
}

/**
 * 🛑 Typed as `StudioSnapshot` rather than composed loose: this leaves the window as `unknown`
 * and is read key by key in the main process. Untyped, a field renamed here left `describeStudio`
 * composing an empty sentence, and the model acting on a studio that is not there.
 */
function studioState(): ActionOutcome {
  const documents = useDocuments.getState()
  const surface = toolSurface()
  const project = useProject.getState()
  /**
   * 🛑 The window's own mirror, NOT `settings.authState()`. That one probes the API — one
   * `models.list` over the wire — and this answer now sits in front of every sentence typed at
   * the assistant, where it used to run only when an MCP client asked.
   */
  const auth = useSettings.getState()

  const snapshot: StudioSnapshot = {
    project: project.project,
    // 🛑 Beside the project itself: its initial `null` means "not asked yet", and a reader that
    // took it for an answer would tell a model there is no project over an open one.
    projectKnown: project.known,
    workspace: useLayouts.getState().activeWorkspace,
    /**
     * The surface, and the scope it puts a command in — the two facts `command.run` refuses on.
     * A client that reads `wrongSurface` needs the SCOPE to know what to activate, and deriving
     * it here rather than leaving it to be looked up is what makes the refusal actionable.
     */
    surface,
    commandScope: scopeOfWorkspace(surface),
    documents: Object.values(documents.documents).map(one => summaryOf(one, documents.activeId)),
    // What the person has designated, which is what a spoken request most often means by "it".
    selection: selectionNow(documents),
    armedModels: useModels.getState().selected,
    authenticated: auth.auth.authenticated,
    // Same reason as `projectKnown`, and the store keeps the flag for it.
    authKnown: auth.authKnown,
  }

  return { ok: true, data: snapshot }
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

async function openByPath(input: Record<string, unknown>): Promise<ActionOutcome> {
  const path = textOf(input, 'path')
  if (path === null) return refused('badInput')

  // Re-read first: the listing a client holds may predate a file that has since arrived, and
  // answering "no such document" for one sitting on the disk is the least useful refusal there is.
  // `'own-write'` rather than a bare call, which joins a listing already in flight — one that may
  // have STARTED before the file appeared, and would answer without it.
  if (!documentAtPath(useDocuments.getState(), path)) {
    await useDocuments.getState().relist('own-write')
  }

  const document = documentAtPath(useDocuments.getState(), path)
  if (!document) return refused('notFound')

  openDocument(document)
  return { ok: true, data: { documentId: document.id } }
}

/**
 * The open document a call names — by id, by path, or by a title only one of them wears.
 *
 * 🛑 By TITLE as well, because the id is the one thing a caller may never have seen: the briefing
 * names open documents in quotes and nothing else, so a model told to bring one back to the front
 * had only its title to answer with, and was refused for it.
 *
 * A title two documents share resolves to neither: guessing between them would activate the wrong
 * one silently, where `notFound` sends the caller to `documents.list` for the id.
 */
function namedDocument(input: Record<string, unknown>): DocumentDescriptor | null {
  const named = textOf(input, 'documentId') ?? ''
  const open = Object.values(useDocuments.getState().documents)
  const byId = useDocuments.getState().documents[named]
  if (byId || named === '') return byId ?? null

  const titled = open.filter(one => one.title === named || one.path === named)
  return titled.length === 1 ? (titled[0] ?? null) : null
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
 * ⌘S on a named document, AWAITED — the difference from `command.run('document.save')`, which
 * saves whatever is in front and answers before the write lands.
 *
 * A throw is a refusal rather than an exception across the boundary: an image whose engine is
 * still booting its GPU context cannot hand its pixels over, and that is `notRenderable` — the
 * same answer an export gives for the same cause.
 */
async function save(input: Record<string, unknown>): Promise<ActionOutcome> {
  const documents = useDocuments.getState()
  const documentId = textOf(input, 'documentId') ?? documents.activeId
  if (documentId === null || !documents.documents[documentId]) return refused('notFound')

  try {
    return { ok: true, data: { written: await saveDocument(documentId) } }
  } catch (error) {
    reportFailure('document.save', documentId, error)
    return refused('notRenderable')
  }
}

/** Deletes the document's file and closes its tab — see `dropDocument` for why nothing is asked. */
async function remove(input: Record<string, unknown>): Promise<ActionOutcome> {
  const documentId = named(input)
  if (documentId === null) return refused('notFound')

  return (await dropDocument(documentId)) ? { ok: true } : refused('failed')
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
      // The six faces alone: a panorama is a menu row, and this door takes no target — offering
      // one here would be a second place to keep the list of them in step.
      return skyboxExportFiles(document.id, {
        kind: 'faces',
        size: numberOf(input, 'size') ?? DEFAULT_FACE,
      })
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
  'document.save': save,
  'document.remove': remove,

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
