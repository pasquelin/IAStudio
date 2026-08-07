import type { DocumentKind } from '@shared/domain/document'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { scenePayload, sceneFromPayload } from '@/engines/scene/scene-document'
import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'
import { markOf, sceneOf, useScenes } from '@/stores/scenes'

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
  capture: (documentId: string) => { content: unknown; commit: () => void }
  install: (documentId: string, content: unknown) => void
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
      content: scenePayload(sceneOf(scenes, documentId)),
      commit: () => useScenes.getState().markSaved(documentId, mark),
    }
  },
  install: (documentId, content) => {
    // `replace`, not a command: loading a document is not something ⌘Z gives back.
    useScenes.getState().replace(documentId, sceneFromPayload(content))
    // What is on screen is now exactly what the disk holds, so the document opens clean.
    useScenes.getState().markSaved(documentId, markOf(useScenes.getState(), documentId))
  },
  // A scene that arrives unlit shows nothing, and reads as a broken viewport rather than as an
  // empty document.
  createDefault: documentId => useScenes.getState().ensure(documentId, createDefaultScene),
  holds: documentId => useScenes.getState().states[documentId] !== undefined,
}

const IO_BY_KIND: Partial<Record<DocumentKind, DocumentIo>> = { scene: SCENE_IO }

const ioOf = (documentId: string): DocumentIo | undefined => {
  const kind = useDocuments.getState().documents[documentId]?.kind
  return kind && IO_BY_KIND[kind]
}

/**
 * Writes the document to the project. Nothing is marked saved when the write fails: the tab
 * keeps its modified marker, which is the only honest thing to show for work not on disk.
 *
 * A document whose state was never filled is refused. `holds` is what separates "empty scene"
 * from "no scene yet", and a read that failed leaves the second — saving then would write an
 * empty document over the file that would not load.
 */
export async function saveDocument(documentId: string): Promise<void> {
  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!bridge || !document || !io || !io.holds(documentId)) return

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
 * A file that fails to read leaves the tab empty and modified rather than falling back to a
 * default: the marker is what says the document on screen is not the one on disk. A document
 * that was simply never saved reads `null`, which is not a failure and takes the default.
 */
export function restoreDocument(documentId: string): Promise<void> {
  const existing = loading.get(documentId)
  if (existing) return existing

  const bridge = getBridge()
  const document = useDocuments.getState().documents[documentId]
  const io = ioOf(documentId)
  if (!io || io.holds(documentId)) return Promise.resolve()

  if (!bridge || !document) {
    io.createDefault(documentId)
    return Promise.resolve()
  }

  // Swallowed rather than rethrown into a mount effect that has nowhere to show it: the main
  // process logs the failed read, and the tab stays empty and modified, which is the signal.
  const reading = bridge.documents
    .read(document.id, document.kind)
    .then(file => (file ? io.install(documentId, file.content) : io.createDefault(documentId)))
    .catch(() => {})
    .finally(() => loading.delete(documentId))

  loading.set(documentId, reading)
  return reading
}
