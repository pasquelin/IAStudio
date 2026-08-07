import type { DocumentKind } from '@shared/domain/document'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { scenePayload, sceneFromPayload } from '@/engines/scene/scene-document'
import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'
import { hasScene, markOf, sceneOf, useScenes } from '@/stores/scenes'
import { newTexture, parseTexture } from '@/engines/texture/texture-state'
import { hasTexture, markOf as textureMarkOf, textureOf, useTextures } from '@/stores/textures'

/**
 * How a kind reaches the disk and comes back. One entry per space that has a serialized form; a
 * kind absent from the table cannot be saved yet, and Save does nothing for it rather than
 * writing a document with an empty body.
 */
type DocumentIo = {
  /**
   * What to write, and how to record that it was written. The two are read together and before
   * the write, so an edit made while the file is on its way to disk is not counted as saved.
   */
  capture: (documentId: string) => { content: string; commit: () => void }
  install: (documentId: string, content: string) => void
  /** What an unsaved document holds until something is done to it. */
  createDefault: (documentId: string) => void
  /** Whether the document is already filled — a remount must not read over what is open. */
  holds: (documentId: string) => boolean
}

const SCENE_IO: DocumentIo = {
  capture: documentId => {
    const scenes = useScenes.getState()
    const mark = markOf(scenes, documentId)

    return {
      // Serialized here, in the window that owns the document: the file layer never parses a
      // content, so the cost of a twenty-thousand-node scene never reaches the main thread.
      content: JSON.stringify(scenePayload(sceneOf(scenes, documentId))),
      commit: () => useScenes.getState().markSaved(documentId, mark),
    }
  },
  install: (documentId, content) => {
    const scenes = useScenes.getState()
    // `replace`, not a command: loading a document is not something ⌘Z gives back.
    scenes.replace(documentId, sceneFromPayload(JSON.parse(content)))
    // What is on screen is now exactly what the disk holds, so the document opens clean.
    scenes.markSaved(documentId, markOf(useScenes.getState(), documentId))
  },
  createDefault: documentId => useScenes.getState().ensure(documentId, createDefaultScene),
  holds: documentId => hasScene(useScenes.getState(), documentId),
}

const TEXTURE_IO: DocumentIo = {
  capture: documentId => {
    const textures = useTextures.getState()
    const mark = textureMarkOf(textures, documentId)

    return {
      content: JSON.stringify(textureOf(textures, documentId)),
      commit: () => useTextures.getState().markSaved(documentId, mark),
    }
  },
  install: (documentId, content) => {
    const textures = useTextures.getState()
    // `replace`, not a command: loading a document is not something ⌘Z gives back.
    textures.replace(documentId, parseTexture(JSON.parse(content)))
    textures.markSaved(documentId, textureMarkOf(useTextures.getState(), documentId))
  },
  createDefault: documentId => useTextures.getState().ensure(documentId, newTexture),
  holds: documentId => hasTexture(useTextures.getState(), documentId),
}

const IO_BY_KIND: Partial<Record<DocumentKind, DocumentIo>> = {
  scene: SCENE_IO,
  texture: TEXTURE_IO,
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

  const { content, commit } = io.capture(documentId)
  await bridge.documents.write(document.id, document.kind, { title: document.title, content })
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

  // Nothing is rethrown into a mount effect that has nowhere to show it. Nothing is logged
  // either: `handle` reports a rejection to no one, and the studio has no error surface yet.
  const reading = bridge.documents
    .read(document.id, document.kind)
    .then(file => {
      // Re-checked after the await: the tab was live while the read was in flight, and the Add
      // menu acts on it. Overwriting that edit would also mark the document clean, leaving an
      // undo stack whose commands describe a scene that never existed.
      if (io.holds(documentId)) return
      if (file) io.install(documentId, file.content)
      else io.createDefault(documentId)
    })
    .catch(() => {
      unreadable.add(documentId)
    })
    .finally(() => loading.delete(documentId))

  loading.set(documentId, reading)
  return reading
}
