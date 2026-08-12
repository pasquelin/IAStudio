import type { Asset } from '@shared/domain/asset'
import {
  isPartName,
  type CloseChoice,
  type DocumentDescriptor,
  type DocumentDraft,
  type DocumentKind,
  type DocumentPart,
} from '@shared/domain/document'
import { EMPTY_GRAPH } from '@shared/domain/graph'
import { parseAudioEdits, EMPTY_AUDIO_EDIT } from '@/engines/audio/edits'
import { parseGraph } from '@/engines/graph/serialize'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { scenePayload, sceneFromPayload } from '@/engines/scene/scene-document'
import { parseSkybox } from '@/engines/skybox/skybox-state'
import { EMPTY_SEQUENCE, parseSequence } from '@/engines/timeline/timeline-state'
import { getBridge } from '@/services/bridge'
import type { StudioBridge } from '@shared/ipc'
import { reportFailure } from '@/services/diagnostics'
import i18next from 'i18next'
import { closePanel, openDocument } from './dockview-api'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { audioEditStore } from '@/stores/audio-edits'
import { useGraphRuns } from '@/stores/graph-runs'
import { graphStore } from '@/stores/graphs'
import { sceneStore } from '@/stores/scenes'
import { sequenceStore } from '@/stores/sequences'
import { skyboxStore } from '@/stores/skyboxes'
import type { DocumentStore } from '@/stores/document-store'
import { DEFAULT_CANVAS, deserializeCanvas, serializeCanvas } from '@/engines/canvas/canvas-state'
import type { LayerPixels } from '@/engines/canvas/CanvasEngine'
import { canvasHost } from '@/spaces/image/canvas-hosts'
import { canvasStore, canvasOf, useCanvases } from '@/stores/canvases'
import { newTexture, parseTexture } from '@/engines/texture/texture-state'
import { useSkyboxViews } from '@/stores/skybox-views'
import { useTextureViews } from '@/stores/texture-views'
import { textureStore } from '@/stores/textures'
import { createSkyboxContent } from '@shared/domain/skybox'

/** What an editor produces to be saved. The title is the tab's, not the editor's. */
type CapturedDraft = Omit<DocumentDraft, 'title'>

/**
 * Where a baked document lands: over the asset it was opened from — ⌘S — or beside it — ⌘⇧S.
 *
 * Overwriting is only safe because the engine leaves a layer whose pixels the document restored
 * alone; `LayerSurface.fromDocument` holds that rule and the reason for it.
 *
 * Both fields optional, and both are sent flat, because `SaveAudioRequest` is shaped that way
 * and two sibling channels saying the same thing differently is worse than a field that goes
 * unread — see `name` below.
 */
export type AssetTarget = {
  /** The asset to overwrite. Absent writes a new one instead. */
  replaces?: string
  /** The picture the new one was edited from. An overwrite keeps the filiation it already had. */
  derivedFrom?: string
  /** Names a NEW asset. Ignored by an overwrite, which keeps the name the asset already has. */
  name: string
}

/**
 * How a kind reaches the disk and comes back. One entry per space that has a serialized form; a
 * kind absent from the table cannot be saved yet, and Save does nothing for it rather than
 * writing a document with an empty body.
 */
type DocumentIo = {
  /**
   * What to write, how to record that it was written, and whether there was anything to write.
   *
   * Asynchronous because an image's pixels live on the GPU and only come back through a promise.
   * **The mark is read synchronously, before the first `await`** — that is the whole property:
   * an edit made while the file is on its way to disk must not be counted as saved.
   *
   * `wasEdited` is read at that same instant, and it is here rather than at the caller for the
   * same reason: `commit` clears the mark, so a caller asking afterwards always hears "no". It
   * is what stops ⌘S on an untouched tab from rewriting the asset behind it.
   */
  capture: (
    documentId: string,
  ) => Promise<{ draft: CapturedDraft; commit: () => void; wasEdited: boolean }>
  install: (documentId: string, content: string, parts?: readonly DocumentPart[]) => void
  /** What an unsaved document holds until something is done to it. */
  createDefault: (documentId: string) => void
  /**
   * Bakes the document into the asset it was opened from — ⌘S — or into a new one beside it —
   * ⌘⇧S. Which of the two is what `target` says.
   *
   * The kind writes it itself rather than handing bytes back: what a picture sends and what a
   * take would send do not have the same shape, and a shared return type would be a union every
   * caller had to take apart again.
   *
   * Answers `null` when there was nothing to bake yet — an engine whose GPU context is still
   * coming up, which is exactly when a save right after switching workspace lands.
   *
   * **Absent means "no copy to make", and every kind but the image leaves it out today** — each
   * says why at its own line of `IO_BY_KIND` rather than here, because the reasons differ.
   */
  writeAsset?: (documentId: string, target: AssetTarget) => Promise<Asset | null>
  /** Whether the document is already filled — a remount must not read over what is open. */
  holds: (documentId: string) => boolean
  /** Whether closing the document would throw work away — never true for an untouched tab. */
  dirty: (documentId: string) => boolean
  /** Drops the state and the history a closed document was holding. */
  forget: (documentId: string) => void
}

/**
 * The kinds a string can hold, which differ only in what their state becomes on the way out and
 * how it is read back in. Written once: the bookkeeping around the crossing — read the mark
 * before the write, hand it back after, load outside the history, open clean — is the same for
 * all of them, and a copy per kind meant a fix landing in one space and not the others.
 *
 * JSON is crossed HERE, never by a caller. A `SyntaxError` from a file that is not JSON at all
 * is what marks the document unreadable and stops the next ⌘S from writing over it — a kind
 * whose own reader swallowed that would lose the protection with nothing to catch it.
 */
function textDocumentIo<S>(
  store: DocumentStore<S>,
  toPayload: (state: S) => unknown,
  fromPayload: (payload: unknown) => S,
  createDefault: () => S,
): DocumentIo {
  return {
    capture: documentId => {
      const current = store.use.getState()
      const mark = store.markOf(current, documentId)

      return Promise.resolve({
        // Serialized in the window that owns the document: the file layer never parses a
        // content, so the biggest of them is never decoded in the main process.
        draft: { content: JSON.stringify(toPayload(store.stateOf(current, documentId))) },
        commit: () => store.use.getState().markSaved(documentId, mark),
        wasEdited: store.hasUnsavedWork(current, documentId),
      })
    },
    install: (documentId, content) => {
      // `replace`, not a command: loading a document is not something ⌘Z gives back.
      store.use.getState().replace(documentId, fromPayload(JSON.parse(content)))
      // What is on screen is now exactly what the disk holds, so the document opens clean.
      const loaded = store.use.getState()
      loaded.markSaved(documentId, store.markOf(loaded, documentId))
    },
    createDefault: documentId => store.use.getState().ensure(documentId, createDefault),
    holds: documentId => store.hasState(store.use.getState(), documentId),
    dirty: documentId => store.hasUnsavedWork(store.use.getState(), documentId),
    forget: documentId => store.use.getState().drop(documentId),
  }
}

/** A state that is already the payload — most kinds store what they serialize. */
const asIs = <S>(state: S): unknown => state

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
 * Whether this document still measures what the asset it edits measures — the one condition
 * under which its flatten may REPLACE that asset's file rather than land beside it.
 *
 * Measured rather than remembered: the picture is already decoded by the layer drawing it, so
 * the browser answers from its cache, and a size carried on the descriptor would be one more
 * field to persist and one more that could drift from the pixels. An asset that will not
 * measure answers `false` — refusing to overwrite is the safe half of the doubt.
 */
async function carriesAsset(documentId: string, assetId: string): Promise<boolean> {
  // Through `import()` for the reason `place-asset` gives: this file is in the opening chunk,
  // and nothing measures a picture until a ⌘S lands on a document that edits one.
  const { measureAsset } = await import('@/spaces/image/picture-size')
  const size = await measureAsset(assetId)
  if (!size) return false

  const canvas = canvasOf(useCanvases.getState(), documentId)
  return canvas.width === size.width && canvas.height === size.height
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
    const wasEdited = canvasStore.hasUnsavedWork(canvases, documentId)
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
      wasEdited,
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
  writeAsset: async (documentId, target) => {
    const bridge = getBridge()
    const host = canvasHost(documentId)
    if (!bridge || !host) return null

    // An overwrite REPLACES the file, so the flatten has to be the picture and not a version of
    // it. A document that no longer measures what the asset does — cropped, resampled, or opened
    // under the ceiling because the picture was enormous — would silently shrink the asset it is
    // standing in for, and `replaceBytes` deletes what it replaces. Refused instead, out loud;
    // ⌘⇧S is the way to keep that result.
    if (target.replaces && !(await carriesAsset(documentId, target.replaces))) {
      throw new Error('the document no longer measures what its asset does')
    }

    // `null` while the engine boots its GPU context, which is exactly when a ⌘S after switching
    // workspace lands. The document is still written; only the asset waits for the next save.
    const png = await host.snapshot()
    if (!png) return null

    const written = await bridge.assets.savePicture({ ...target, png })
    // After the write, and only for an overwrite: the id did not move, so the loader would keep
    // answering with the picture it cached before this save.
    if (target.replaces) await host.forgetPicture(target.replaces)
    return written
  },
  createDefault: documentId => useCanvases.getState().ensure(documentId, () => DEFAULT_CANVAS),
  holds: documentId => canvasStore.hasState(useCanvases.getState(), documentId),
  dirty: documentId => canvasStore.hasUnsavedWork(useCanvases.getState(), documentId),
  forget: documentId => useCanvases.getState().drop(documentId),
}

/**
 * A graph carries a RUN beside its state — what each node is doing, and what it produced.
 *
 * Session state, so it is not saved; but it must go when the document does, because its cache
 * names local assets of a project that is being left, and the run itself would otherwise keep
 * submitting into a tab nobody can see.
 */
const withGraphRun = (io: DocumentIo): DocumentIo => ({
  ...io,
  forget: documentId => {
    useGraphRuns.getState().forget(documentId)
    io.forget(documentId)
  },
})

/**
 * Every kind the studio can write, and the only place a kind is declared savable. A kind absent
 * here has a Save that does nothing rather than one that writes an empty body.
 */
const IO_BY_KIND: Record<DocumentKind, DocumentIo> = {
  image: IMAGE_IO,
  // No `writeAsset`, and the reason is the kind itself: a scene is not a mesh — the asset it was
  // opened from is one node of it.
  scene: textDocumentIo(sceneStore, scenePayload, sceneFromPayload, createDefaultScene),
  // Nor here: rendering a montage is minutes of work, which has no business on a keystroke.
  sequence: textDocumentIo(sequenceStore, asIs, parseSequence, () => EMPTY_SEQUENCE),
  // No `writeAsset`, for the reason the editor states itself: a take is a REPLAYABLE chain over
  // a decoded source, and « nothing is written to disk until apply or save as ». Baking it into
  // its own source would leave the chain in the document and apply it a second time on reopen —
  // and its own toolbar already offers both writes, where a hand asks for them.
  audio: textDocumentIo(audioEditStore, asIs, parseAudioEdits, () => EMPTY_AUDIO_EDIT),
  // Nor here: `adjustments` are applied over a source left intact, and baking them into it would
  // destroy the only copy of what they are meant to stay undoable against.
  skybox: textDocumentIo(skyboxStore, asIs, parseSkybox, createSkyboxContent),
  // The one whose absence is NOT a refusal: a channel is a reference, not pixels, and what does
  // produce pixels — `derive-channel` — already writes them as an asset when it derives them.
  texture: textDocumentIo(textureStore, asIs, parseTexture, newTexture),
  graph: withGraphRun(textDocumentIo(graphStore, asIs, parseGraph, () => EMPTY_GRAPH)),
}

/** `undefined` for an id no tab is showing — never for a kind that cannot be saved. */
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
 * What both saving gestures need before they can write anything, or `null` when one of them is
 * missing — which is the same refusal for both, said once.
 *
 * `holds` separates "empty scene" from "no scene yet", and `unreadable` is the file that would
 * not read: writing over it is the one thing that loses work irrecoverably, so neither gesture
 * gets past this.
 */
function savableDocument(
  documentId: string,
): { bridge: StudioBridge; document: DocumentDescriptor; io: DocumentIo } | null {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!bridge || !document || !io) return null
  if (unreadable.has(documentId) || !io.holds(documentId)) return null

  return { bridge, document, io }
}

/**
 * Writes the document to the project, and then the asset it edits — what ⌘S means on a tab
 * opened from the shelf. A document whose state was never filled is refused: `holds` separates
 * "empty scene" from "no scene yet".
 *
 * Answers whether anything was written. A refusal is not a failure — there was nothing to write,
 * or the file must not be written over — but a caller about to throw the state away has to be
 * able to tell that from a save that happened. It is what stops "Save" on a document whose file
 * would not read from closing the tab on work that never reached the disk.
 */
export async function saveDocument(documentId: string): Promise<boolean> {
  const savable = savableDocument(documentId)
  if (!savable) return false
  const { bridge, document, io } = savable

  const { draft, commit, wasEdited } = await io.capture(documentId)
  await bridge.documents.write(document.id, document.kind, {
    ...draft,
    title: document.title,
    // Written from the descriptor for the same reason the title is: the tab owns both, and the
    // captured draft is the editor's state alone.
    ...(document.sourceAssetId ? { sourceAssetId: document.sourceAssetId } : {}),
  })
  commit()

  await rewriteSourceAsset(document, io, wasEdited)
  // The folder now holds a file it did not: a document saved for the first time has to appear
  // in the Explorer without waiting for the panel to be reopened.
  void useDocuments.getState().relist('own-write')
  return true
}

/**
 * The second half of ⌘S: the asset the tab was opened from, brought back in line with it.
 *
 * AFTER the document, and the order is the guarantee — the document holds the layers and the
 * history, the asset only a flat picture, so writing the asset first and failing on the document
 * would leave a fresh tile in front of lost work. A failure here undoes nothing and does not mark
 * the document dirty: it goes to the journal, and the next ⌘S catches the tile up.
 *
 * Nothing at all for a document that edits no asset, for a kind whose `writeAsset` is absent —
 * every refusal in `IO_BY_KIND` says why at its own line — or for a tab nobody touched.
 */
async function rewriteSourceAsset(
  document: DocumentDescriptor,
  io: DocumentIo,
  wasEdited: boolean,
): Promise<void> {
  const source = document.sourceAssetId
  if (!wasEdited || !source || !io.writeAsset) return

  try {
    await io.writeAsset(document.id, { replaces: source, name: document.title })
    // The tile still holds the bitmap it decoded: only a fresh `localChangedAt` moves the URL
    // `posterUrl` builds, and without it the overwrite looks like a gesture that did nothing.
    //
    // `invalidate`, like every other site that says the catalogue changed: `assets.search` is a
    // synchronous SQLite query in the main process, and a held ⌘S would open one per keystroke
    // on the path of a shortcut.
    useAssets.getState().invalidate()
  } catch (error) {
    reportFailure('assets.save', document.title, error)
  }
}

/**
 * Writes a COPY of the asset beside the original, and carries the tab on with the copy.
 *
 * What ⌘⇧S means in every application: the file that was open stays as it was at the last save,
 * and the work continues on the new one. Here the file is an asset — `derivedFrom` keeps the two
 * traceable to each other, which a copy on disk could not say.
 *
 * The copy is NOT named by a dialog. The audio editor settled that first: its « save as new »
 * derives a name and the renaming happens in the inspector, so asking here would be a second way
 * to name an asset, next to a gesture that never asks.
 *
 * Answers whether anything was written, like `saveDocument` — a document that edits no asset has
 * nothing to copy, and says so in the journal rather than in silence.
 */
export async function saveDocumentAs(documentId: string): Promise<boolean> {
  const savable = savableDocument(documentId)
  if (!savable) return false
  const { bridge, document, io } = savable

  const source = document.sourceAssetId
  // No asset to derive from, or a kind that bakes to nothing one could hold: both are "there is
  // no copy to make", and both are said out loud rather than doing nothing quietly.
  if (!source || !io.writeAsset) {
    reportFailure('assets.save', document.title, new Error('nothing to copy'))
    return false
  }

  const name = i18next.t('documents.copyName', { name: document.title })

  try {
    const copy = await io.writeAsset(documentId, { derivedFrom: source, name })
    if (!copy) {
      reportFailure('assets.save', document.title, new Error('nothing to bake yet'))
      return false
    }

    // The document SECOND, and pointed at the copy: the tab carries on with the new asset, and
    // the one that was open keeps whatever the last ⌘S left on it.
    const { draft } = await io.capture(documentId)
    const created = await useDocuments
      .getState()
      .create(document.workspace, { title: name, sourceAssetId: copy.id })

    // The asset is already on disk by now, so a failure past this point leaves it there with no
    // document naming it. Said out loud rather than swallowed: the copy is in the shelf, and a
    // user who cannot see why has no way to find that out.
    if (!created) {
      reportFailure('assets.save', document.title, new Error('no document for the copy'))
      return false
    }

    await bridge.documents.write(created.id, created.kind, {
      ...draft,
      title: name,
      // The link, written like `saveDocument` writes it — without it the copy would come back
      // from disk knowing nothing of the asset it was made for.
      sourceAssetId: copy.id,
    })

    // NOT installed here, and `commit` is not called either. `install` would replace the state
    // before the copy's panel exists, so `IMAGE_IO` would find no engine to hand the pixels to
    // and drop them — and `holds` being true afterwards makes `restoreDocument` skip the read
    // that would have fixed it, leaving a blank tab the next ⌘S writes over the copy. `commit`
    // closes over the ORIGINAL id, and would clear the bullet of a tab nothing was written for.
    // Opening the tab reads the file that has just been written, which is the whole point.
    openDocument(created)

    await useAssets.getState().refresh()
    void useDocuments.getState().relist('own-write')
    return true
  } catch (error) {
    reportFailure('assets.save', document.title, error)
    return false
  }
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

/** Whether closing would throw work away. A tab that never filled, or was never touched, has none. */
function documentIsDirty(documentId: string): boolean {
  const io = ioOf(documentId)
  return io !== undefined && io.holds(documentId) && io.dirty(documentId)
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
/**
 * What the user wants done with a document's unsaved work. `cancel` when nothing answered —
 * the one default that loses nothing.
 */
async function askAboutUnsavedWork(documentId: string): Promise<CloseChoice> {
  const title = useDocuments.getState().documents[documentId]?.title ?? ''
  return (await getBridge()?.documents.confirmClose(title)) ?? 'cancel'
}

export async function closeDocument(documentId: string): Promise<boolean> {
  if (documentIsDirty(documentId)) {
    const choice = await askAboutUnsavedWork(documentId)
    if (choice === 'cancel') return false
    // Left open unless the work actually reached the disk — a write that throws, and one that is
    // refused because the file would not read, both leave the tab exactly where it was. Closing
    // anyway would lose the work the dialog had just promised to keep.
    if (choice === 'save' && !(await saveDocument(documentId))) return false
  }

  forgetDocument(documentId)
  return true
}

/** The documents whose work would go with the window. Empty when nothing is at stake. */
export function unsavedDocumentIds(): string[] {
  return Object.keys(useDocuments.getState().documents).filter(documentIsDirty)
}

/**
 * Asks about every document holding unsaved work, then acts on the answers — in that order, and
 * the order is the point.
 *
 * Cancelling the last question must leave the studio exactly as it was, so nothing is written and
 * nothing is dropped until every document has been answered for. Closing them as the answers came
 * in would have thrown away the documents answered before the one that cancelled.
 *
 * `false` when the user cancelled, or when a save refused — either way the window stays.
 */
export async function settleUnsavedWork(): Promise<boolean> {
  const answers: Array<{ documentId: string; choice: CloseChoice }> = []

  for (const documentId of unsavedDocumentIds()) {
    const choice = await askAboutUnsavedWork(documentId)
    // Nothing further is asked: the gesture is off, so the documents behind this one are not
    // even questioned, let alone touched.
    if (choice === 'cancel') return false
    answers.push({ documentId, choice })
  }

  for (const { documentId, choice } of answers) {
    // Same order as `closeDocument`: the file is written before anything is forgotten, so a save
    // that fails leaves the work where it was rather than having already dropped it.
    if (choice === 'save' && !(await saveDocument(documentId))) return false
    forgetDocument(documentId)
  }

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
  // The row has to go with the file. Left standing, a double-click on it would open an empty
  // document under the same id — and the next ⌘S would write back what was just deleted.
  void useDocuments.getState().relist('own-write')
  return true
}

/**
 * Reconciles the open tabs with the folder, and drops what that leaves behind.
 *
 * `refresh` settles which tabs survive by rewriting the store's map in one write — deliberately,
 * since closing them one by one would paint and unpaint every tab. Nothing it drops therefore
 * passes through `forgetDocument`, and the session views of a project being left outlived it.
 *
 * The two halves are one call so they cannot be dissociated: after the write nothing names the
 * documents that went, so whoever refreshes has to have read them first. Descriptors, not ids —
 * the kind is what says which `DocumentIo` holds a document's state, and it is read from the
 * very map the refresh has already emptied.
 */
export async function refreshDocuments(): Promise<boolean> {
  const wereOpen = Object.values(useDocuments.getState().documents)
  const answered = await useDocuments.getState().refresh()

  const { documents } = useDocuments.getState()
  for (const document of wereOpen) {
    if (!documents[document.id]) forgetDocument(document.id, document.kind)
  }

  return answered
}

/**
 * Drops everything a document was holding, in the window and in the layout.
 *
 * Its refusal to save is dropped too: the id is the project folder's to hand out again, and a
 * document reopened later must not inherit the verdict passed on the one before it.
 *
 * `kind` is for the one caller whose document is already out of the store — without it `ioOf`
 * finds no descriptor, and the engine state of every document a project change closed would be
 * kept for the rest of the session.
 */
function forgetDocument(documentId: string, kind?: DocumentKind): void {
  const io = kind ? IO_BY_KIND[kind] : ioOf(documentId)
  io?.forget(documentId)
  unreadable.delete(documentId)
  // Session views are not the document's state, so no `DocumentIo` drops them. `useCanvasViews`
  // and `useSceneViews` still keep their entry for the session — they hold a viewport, which is
  // harmless to inherit; an inspected channel is not, it would reopen the tab on a flat map.
  // A sky's view is of the second kind: it carries a projection and the test objects, and a
  // fresh document opening onto the cross of its predecessor is not what was asked for.
  useTextureViews.getState().forget(documentId)
  useSkyboxViews.getState().forget(documentId)
  closePanel(documentId)
  useDocuments.getState().close(documentId)
}
