import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  documentPath,
  DOCUMENT_VERSION,
  type DocumentDraft,
  type DocumentFile,
  type DocumentKind,
} from '@shared/domain/document'
import { parseDocumentFile } from './validation'

export type DocumentFiles = {
  /** `null` when the document has never been saved — an open tab that holds nothing yet. */
  read: (id: string, kind: DocumentKind) => Promise<DocumentFile | null>
  write: (id: string, kind: DocumentKind, draft: DocumentDraft) => Promise<void>
  remove: (id: string, kind: DocumentKind) => Promise<void>
}

export type DocumentFilesDeps = {
  projectPath: () => string
  now: () => string
}

/** Node reports a missing path this way, and it is the one failure that is not an error here. */
function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/**
 * Documents as files in the project folder — a document is the user's own work, and it has to
 * survive a catalogue rebuilt from that folder.
 */
export function createDocumentFiles({ projectPath, now }: DocumentFilesDeps): DocumentFiles {
  /** In-flight work per file, so writing and removing one document cannot interleave. */
  const pending = new Map<string, Promise<unknown>>()

  const fileOf = (id: string, kind: DocumentKind): string =>
    join(projectPath(), documentPath(id, kind))

  /**
   * Queues an operation behind whatever else touches this file. Without it an autosave still
   * writing its staging copy renames it back over a document deleted meanwhile, and the
   * deletion undoes itself.
   */
  const queued = <T>(file: string, run: () => Promise<T>): Promise<T> => {
    const next = (pending.get(file) ?? Promise.resolve()).then(run, run)
    // Settled either way: a failed operation must not block the file for the rest of the session.
    pending.set(
      file,
      next.catch(() => {}),
    )
    return next
  }

  const store = async (file: string, document: DocumentFile): Promise<void> => {
    // Unique per call: the staging copy of one window must not be the staging copy of another.
    const staging = `${file}.${randomUUID()}.tmp`

    // The folder is the user's and may have gone since the project was opened; losing a save
    // to a missing folder is worse than an `mkdir` that almost always does nothing.
    await mkdir(dirname(file), { recursive: true })

    try {
      // No indentation: a scene of twenty thousand nodes doubles in size, and `stringify` is
      // synchronous in the process every window's responsiveness sits on.
      await writeFile(staging, JSON.stringify(document), 'utf8')
      // Renaming within a folder is atomic, so a crash mid-write can never leave a truncated
      // document where the user's work was. Durability across a power cut would want `fsync`.
      await rename(staging, file)
    } catch (error) {
      await rm(staging, { force: true })
      throw error
    }
  }

  return {
    read: async (id, kind) => {
      const file = fileOf(id, kind)

      let document: DocumentFile
      try {
        document = parseDocumentFile(JSON.parse(await readFile(file, 'utf8')))
      } catch (error) {
        if (isMissing(error)) return null
        throw error
      }

      // The folder's word beats the file's. A document copied to another extension by hand
      // would otherwise open in the wrong editor, with the wrong content.
      if (document.kind !== kind) {
        throw new Error(`Document ${id} holds a ${document.kind}, not a ${kind}`)
      }
      return document
    },

    write: (id, kind, draft) => {
      const file = fileOf(id, kind)
      return queued(file, () =>
        store(file, { ...draft, version: DOCUMENT_VERSION, kind, updatedAt: now() }),
      )
    },

    // `force`: closing a document that was never saved must not fail on a file that is absent.
    remove: async (id, kind) => {
      const file = fileOf(id, kind)
      await queued(file, () => rm(file, { force: true }))
    },
  }
}
