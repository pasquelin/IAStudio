import {
  isPartName,
  type DocumentDraft,
  type DocumentKind,
  type DocumentPart,
} from '@shared/domain/document'
import { parseAudioEdits, serializeAudioEdits, EMPTY_AUDIO_EDIT } from '@/engines/audio/edits'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { scenePayload, sceneFromPayload } from '@/engines/scene/scene-document'
import { parseSkybox, serializeSkybox } from '@/engines/skybox/skybox-state'
import { EMPTY_SEQUENCE, parseSequence, serializeSequence } from '@/engines/timeline/timeline-state'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { closePanel } from './dockview-api'
import { useDocuments } from '@/stores/documents'
import { audioEditStore } from '@/stores/audio-edits'
import { sceneStore } from '@/stores/scenes'
import { sequenceStore } from '@/stores/sequences'
import { skyboxStore } from '@/stores/skyboxes'
import type { DocumentStore } from '@/stores/document-store'
import { DEFAULT_CANVAS, deserializeCanvas, serializeCanvas } from '@/engines/canvas/canvas-state'
import type { LayerPixels } from '@/engines/canvas/CanvasEngine'
import { canvasHost } from '@/spaces/image/canvas-hosts'
import { canvasStore, canvasOf, useCanvases } from '@/stores/canvases'
import { newTexture, parseTexture } from '@/engines/texture/texture-state'
import { textureStore } from '@/stores/textures'
import { createSkyboxContent } from '@shared/domain/skybox'

/** What an editor produces to be saved. The title is the tab's, not the editor's. */
type CapturedDraft = Omit<DocumentDraft, 'title'>

/**
 * How a kind reaches the disk and comes back. One entry per space that has a serialized form; a
 * kind absent from the table cannot be saved yet, and Save does nothing for it rather than
 * writing a document with an empty body.
 */
type DocumentIo = {
  /**
   * What to write, and how to record that it was written.
   *
   * Asynchronous because an image's pixels live on the GPU and only come back through a promise.
   * **The mark is read synchronously, before the first `await`** — that is the whole property:
   * an edit made while the file is on its way to disk must not be counted as saved.
   */
  capture: (documentId: string) => Promise<{ draft: CapturedDraft; commit: () => void }>
  install: (documentId: string, content: string, parts?: readonly DocumentPart[]) => void
  /** What an unsaved document holds until something is done to it. */
  createDefault: (documentId: string) => void
  /** Whether the document is already filled — a remount must not read over what is open. */
  holds: (documentId: string) => boolean
  /** Whether the document has work its file does not hold. */
  dirty: (documentId: string) => boolean
  /** Drops the state and the history a closed document was holding. */
  forget: (documentId: string) => void
}

/**
 * The five kinds a string can hold, which differ only in how their state turns into text and
 * back. Written once: the bookkeeping around the crossing — read the mark before the write,
 * hand it back after, load outside the history, open clean — is the same for all of them, and
 * five copies of it meant a fix landing in one space and not the others.
 */
function textDocumentIo<S>(
  store: DocumentStore<S>,
  serialize: (state: S) => string,
  parse: (content: string) => S,
  createDefault: () => S,
): DocumentIo {
  return {
    capture: documentId => {
      const current = store.use.getState()
      const mark = store.markOf(current, documentId)

      return Promise.resolve({
        // Serialized here, in the window that owns the document: the file layer never parses a
        // content, so the cost of a twenty-thousand-node scene never reaches the main thread.
        draft: { content: serialize(store.stateOf(current, documentId)) },
        commit: () => store.use.getState().markSaved(documentId, mark),
      })
    },
    install: (documentId, content) => {
      // `replace`, not a command: loading a document is not something ⌘Z gives back.
      store.use.getState().replace(documentId, parse(content))
      // What is on screen is now exactly what the disk holds, so the document opens clean.
      const loaded = store.use.getState()
      loaded.markSaved(documentId, store.markOf(loaded, documentId))
    },
    createDefault: documentId => store.use.getState().ensure(documentId, createDefault),
    holds: documentId => store.hasState(store.use.getState(), documentId),
    dirty: documentId => store.isDirty(store.use.getState(), documentId),
    forget: documentId => store.use.getState().drop(documentId),
  }
}

/**
 * What a surface's pixels are called inside `<id>.img/`. The role goes in FRONT of the id, never
 * behind it: a suffix would not be injective — a layer literally called `x-mask` and the mask of
 * a layer called `x` would claim the same file, and one would silently overwrite the other.
 *
 * `null` for an id that could not be a file name. Ids are UUIDs today, but `reviveLayer` takes
 * whatever a file holds, and one odd id must cost that layer's pixels — never the whole save.
 */
function partName(pixels: LayerPixels): string | null {
  const name = `${pixels.mask ? 'm' : 'p'}_${pixels.layerId}.png`
  return isPartName(name) ? name : null
}

/** The other way round, for the read: anything else in the folder is not ours. */
function pixelsFromPart(name: string, data: string): LayerPixels | null {
  const match = /^([pm])_(.+)\.png$/.exec(name)
  return match?.[2] ? { layerId: match[2], mask: match[1] === 'm', data } : null
}

/**
 * The image, which is the one kind a string cannot hold: the stack goes in the manifest, and each
 * layer's texture in a PNG beside it. The pixels live on the GPU, so they are asked of the engine
 * holding the document — see `canvasHost`.
 */
const IMAGE_IO: DocumentIo = {
  capture: async documentId => {
    const canvases = useCanvases.getState()
    // Read before the first await, which is the whole reason `capture` may be asynchronous: an
    // edit made while the pixels are being extracted must not be counted as saved.
    const mark = canvasStore.markOf(canvases, documentId)
    const content = serializeCanvas(canvasOf(canvases, documentId))

    const host = canvasHost(documentId)
    // Refused rather than written empty. A folder is replaced whole, so a save with no pictures
    // would delete the ones on disk AND mark the document clean — the work would be gone with
    // nothing said. The engine is unreachable while it boots its GPU context, which is exactly
    // when a ⌘S after switching workspace lands.
    if (!host) throw new Error(`No editor holds ${documentId}: its pixels cannot be read`)

    const taken = await host.pixelSnapshots()
    const parts: DocumentPart[] = []
    for (const pixels of taken) {
      const name = partName(pixels)
      if (name) parts.push({ name, data: pixels.data })
    }

    return {
      draft: { content, parts },
      commit: () => useCanvases.getState().markSaved(documentId, mark),
    }
  },
  install: (documentId, content, parts = []) => {
    const canvases = useCanvases.getState()
    // `replace`, not a command: loading a document is not something ⌘Z gives back.
    canvases.replace(documentId, deserializeCanvas(content))
    canvases.markSaved(documentId, canvasStore.markOf(useCanvases.getState(), documentId))

    // After the state, never before: the engine builds a surface per layer of the state it was
    // given, and pixels aimed at a layer it has not heard of yet land nowhere.
    const host = canvasHost(documentId)
    if (!host) return
    for (const part of parts) {
      const pixels = pixelsFromPart(part.name, part.data)
      // Nothing is rethrown into a mount effect that has nowhere to show it — see `restoreDocument`.
      if (pixels) void host.restoreSnapshot(pixels).catch(() => undefined)
    }
  },
  createDefault: documentId => useCanvases.getState().ensure(documentId, () => DEFAULT_CANVAS),
  holds: documentId => canvasStore.hasState(useCanvases.getState(), documentId),
  dirty: documentId => canvasStore.isDirty(useCanvases.getState(), documentId),
  forget: documentId => useCanvases.getState().drop(documentId),
}

/**
 * Every kind the studio can write, and the only place a kind is declared savable. A kind absent
 * here has a Save that does nothing rather than one that writes an empty body.
 */
const IO_BY_KIND: Partial<Record<DocumentKind, DocumentIo>> = {
  image: IMAGE_IO,
  scene: textDocumentIo(
    sceneStore,
    state => JSON.stringify(scenePayload(state)),
    content => sceneFromPayload(JSON.parse(content)),
    createDefaultScene,
  ),
  sequence: textDocumentIo(
    sequenceStore,
    serializeSequence,
    content => parseSequence(JSON.parse(content)),
    () => EMPTY_SEQUENCE,
  ),
  audio: textDocumentIo(
    audioEditStore,
    serializeAudioEdits,
    content => parseAudioEdits(JSON.parse(content)),
    () => EMPTY_AUDIO_EDIT,
  ),
  skybox: textDocumentIo(
    skyboxStore,
    serializeSkybox,
    content => parseSkybox(JSON.parse(content)),
    createSkyboxContent,
  ),
  texture: textDocumentIo(
    textureStore,
    state => JSON.stringify(state),
    content => parseTexture(JSON.parse(content)),
    newTexture,
  ),
}

const ioOf = (documentId: string): DocumentIo | undefined => {
  const kind = useDocuments.getState().documents[documentId]?.kind
  return kind && IO_BY_KIND[kind]
}

/**
 * Documents whose file would not read. Their tab shows an empty editor, which is indistinguishable
 * from a new one — so without this the user adds a node, the state exists, and the next ⌘S writes
 * that over the scene nothing could read. The file is the only copy: refusing to write it is the
 * one safe answer, and it stands until the document is opened again.
 */
const unreadable = new Set<string>()

/**
 * Writes the document to the project. A document whose state was never filled is refused:
 * `holds` separates "empty scene" from "no scene yet".
 */
export async function saveDocument(documentId: string): Promise<void> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!bridge || !document || !io) return
  if (unreadable.has(documentId) || !io.holds(documentId)) return

  const { draft, commit } = await io.capture(documentId)
  await bridge.documents.write(document.id, document.kind, { ...draft, title: document.title })
  commit()
}

/**
 * Reads in flight, so a panel that mounts twice reads once. React's StrictMode runs every mount
 * effect twice in development, and `DocumentArea` is keyed on the workspace — switching space
 * and back remounts every open document.
 */
const loading = new Map<string, Promise<void>>()

/**
 * Fills a document's tab on mount: from the project when a file is there, from the space's own
 * default otherwise. Idempotent — reopening a tab must not reset what is in it.
 *
 * A file that fails to read leaves the tab empty rather than taking the default, which a later
 * ⌘S would write over it. A document never saved reads `null` — not a failure, and it takes the
 * default like any new tab.
 */
export function restoreDocument(documentId: string): Promise<void> {
  const existing = loading.get(documentId)
  if (existing) return existing

  const bridge = getBridge()
  // A descriptor is what `ioOf` reads the kind from, so a missing one has already returned.
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!io || io.holds(documentId)) return Promise.resolve()

  if (!bridge || !document) {
    io.createDefault(documentId)
    return Promise.resolve()
  }

  unreadable.delete(documentId)

  // Nothing is rethrown into a mount effect that has nowhere to show it — it is reported from
  // here instead, which is the one place that knows a read failed. Without that, the empty
  // editor a failed read leaves is indistinguishable from a new document, and the refusal to
  // save it then looks like a ⌘S that does nothing.
  const reading = bridge.documents
    .read(document.id, document.kind)
    .then(file => {
      // Re-checked after the await: the tab was live while the read was in flight, and the Add
      // menu acts on it. Overwriting that edit would also mark the document clean, leaving an
      // undo stack whose commands describe a scene that never existed.
      if (io.holds(documentId)) return
      if (file) io.install(documentId, file.content, file.parts)
      else io.createDefault(documentId)
    })
    .catch(error => {
      unreadable.add(documentId)
      reportFailure('document.load', document.title, error)
    })
    .finally(() => loading.delete(documentId))

  loading.set(documentId, reading)
  return reading
}

/**
 * Whether the document has work its file does not hold. `false` for a kind that cannot be
 * saved and for a tab that never filled: neither has anything to lose.
 */
export function documentIsDirty(documentId: string): boolean {
  const io = ioOf(documentId)
  return io ? io.holds(documentId) && io.dirty(documentId) : false
}

/**
 * Closes a document: asks about unsaved work, writes it if that is the answer, then drops its
 * state, its history and its tab. `false` when the user cancelled, which is the one answer that
 * leaves everything as it was.
 *
 * The order matters. The file is written before anything is forgotten — a save that fails must
 * not have already thrown the work away — and the question is asked before the write so that a
 * cancelled dialog costs nothing.
 */
export async function closeDocument(documentId: string): Promise<boolean> {
  const io = ioOf(documentId)

  if (io && documentIsDirty(documentId)) {
    const title = useDocuments.getState().documents[documentId]?.title ?? ''
    const choice = (await getBridge()?.documents.confirmClose(title)) ?? 'cancel'
    if (choice === 'cancel') return false
    // Left open on a failed write: closing anyway would lose the work the dialog just promised
    // to keep, and the failure is reported by the caller.
    if (choice === 'save') await saveDocument(documentId)
  }

  forgetDocument(documentId)
  return true
}

/**
 * Removes the document's file from the project, then closes its tab. Confirmed first, and by
 * the OS: this is the one gesture in the studio that destroys a file the user made.
 *
 * Unsaved work is not offered for saving on the way out — the file is going. Answering "save"
 * to a document about to be deleted would write it and delete it in the same breath.
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  if (!bridge || !document) return false

  if (!(await bridge.documents.confirmDelete(document.title))) return false

  await bridge.documents.remove(document.id, document.kind)
  forgetDocument(documentId)
  return true
}

/**
 * Drops everything a document was holding, in the window and in the layout.
 *
 * Its refusal to save is dropped too: the id is the project folder's to hand out again, and a
 * document reopened later must not inherit the verdict passed on the one before it.
 */
function forgetDocument(documentId: string): void {
  ioOf(documentId)?.forget(documentId)
  unreadable.delete(documentId)
  closePanel(documentId)
  useDocuments.getState().close(documentId)
}
