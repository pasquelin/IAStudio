import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import {
  documentPath,
  DOCUMENTS_FOLDER,
  DOCUMENT_VERSION,
  kindForExtension,
  workspaceForKind,
  type DocumentDescriptor,
  type DocumentDraft,
  type DocumentFile,
  type DocumentKind,
} from '@shared/domain/document'
import { parseDocumentFile } from './validation'

export type DocumentFiles = {
  /**
   * Every document of the open project. The folder is what says which ones exist: a registry
   * kept beside it would follow the application rather than the project, and opening another
   * one would show the previous project's tabs.
   */
  list: () => Promise<DocumentDescriptor[]>
  /** `null` when the document has never been saved — an open tab that holds nothing yet. */
  read: (id: string, kind: DocumentKind) => Promise<DocumentFile | null>
  write: (id: string, kind: DocumentKind, draft: DocumentDraft) => Promise<void>
  remove: (id: string, kind: DocumentKind) => Promise<void>
}

const STAGING_SUFFIX = '.tmp'

/**
 * A staging copy of ours, and only ours: `<file>.<uuid>.tmp`. The project folder is the user's
 * own, and a `render.tmp` they left in there is not something to delete on their behalf.
 */
const STAGING_PATTERN = /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/i

/**
 * The staging copies in a folder that nobody is writing any more — the remains of a process
 * that died between the write and the rename, which the `catch` of a failed write never sees.
 *
 * `inFlight` is what keeps a save happening right now from being swept: every window writes
 * through the one main process, so that set is the whole truth about who is holding what.
 *
 * Pure, and separate from the sweep itself: `readdir` and `rm` are as testable as any other
 * disk call, which is to say not, and the rule is the part worth being sure of.
 */
export function orphanStagingCopies(
  entries: readonly string[],
  inFlight: ReadonlySet<string>,
): string[] {
  return entries.filter(entry => STAGING_PATTERN.test(entry) && !inFlight.has(entry))
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

  /** The staging copies being written right now. Every window writes through this one map. */
  const staging = new Set<string>()

  const store = async (file: string, document: DocumentFile): Promise<void> => {
    // Unique per call: the staging copy of one window must not be the staging copy of another.
    const copy = `${file}.${randomUUID()}${STAGING_SUFFIX}`
    staging.add(basename(copy))

    // The folder is the user's and may have gone since the project was opened; losing a save
    // to a missing folder is worse than an `mkdir` that almost always does nothing.
    await mkdir(dirname(file), { recursive: true })

    try {
      // No indentation: a scene of twenty thousand nodes doubles in size, and `stringify` is
      // synchronous in the process every window's responsiveness sits on.
      await writeFile(copy, JSON.stringify(document), 'utf8')
      // Renaming within a folder is atomic, so a crash mid-write can never leave a truncated
      // document where the user's work was. Durability across a power cut would want `fsync`.
      await rename(copy, file)
    } catch (error) {
      await rm(copy, { force: true })
      throw error
    } finally {
      staging.delete(basename(copy))
    }
  }

  /** Swept while listing rather than on a timer: nothing else ever reads that folder. */
  const sweep = async (folder: string, entries: readonly string[]): Promise<void> => {
    // Failure is nothing to report: the listing is what was asked for, and the copy will be
    // offered again at the next open.
    await Promise.all(
      orphanStagingCopies(entries, staging).map(orphan =>
        rm(join(folder, orphan), { force: true }),
      ),
    )
  }

  const descriptorOf = async (
    folder: string,
    entry: string,
  ): Promise<DocumentDescriptor | null> => {
    const kind = kindForExtension(extname(entry))
    const workspace = kind && workspaceForKind(kind)
    if (!kind || !workspace) return null

    try {
      const document = parseDocumentFile(JSON.parse(await readFile(join(folder, entry), 'utf8')))
      // The folder's word beats the file's, exactly as `read` has it: an extension changed by
      // hand must not send a document to an editor that cannot open it.
      if (document.kind !== kind) return null

      return { id: basename(entry, extname(entry)), kind, title: document.title, workspace }
    } catch {
      // One unreadable document must not cost the user the listing of all the others.
      return null
    }
  }

  return {
    list: async () => {
      const folder = join(projectPath(), DOCUMENTS_FOLDER)

      let entries: string[]
      try {
        entries = await readdir(folder)
      } catch (error) {
        // A project that has never saved anything has no folder yet, and holds no document.
        if (isMissing(error)) return []
        throw error
      }

      await sweep(folder, entries)

      // One at a time rather than all at once: a folder of a few thousand documents opened in
      // parallel runs the process out of file descriptors, and every failed read would come
      // back as a document silently missing from the list.
      const found: DocumentDescriptor[] = []
      for (const entry of entries) {
        const descriptor = await descriptorOf(folder, entry)
        if (descriptor) found.push(descriptor)
      }
      return found
    },

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
