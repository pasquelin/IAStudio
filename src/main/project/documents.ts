import { randomUUID } from 'node:crypto'
import { mkdir, open, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import {
  DOCUMENT_MANIFEST,
  documentPath,
  DOCUMENTS_FOLDER,
  DOCUMENT_VERSION,
  ENVELOPE_LIMIT,
  FOLDER_KINDS,
  isPartName,
  kindForExtension,
  workspaceForKind,
  type DocumentDescriptor,
  type DocumentDraft,
  type DocumentEnvelope,
  type DocumentFile,
  type DocumentKind,
  type DocumentPart,
} from '@shared/domain/document'
import { isRecord } from '@shared/guards'
import { parseDocumentEnvelope } from './validation'

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

/**
 * A file read back: the envelope off its first line, the content left as the string the editor
 * wrote. Nothing here parses the content — that is the editor's business, on its own thread.
 *
 * A file written by version 1 has no line of its own: its whole body is one object, content
 * included. It is put back into the current shape rather than refused — that is what the
 * version field was for.
 */
export function splitDocument(body: string): DocumentFile {
  const cut = body.indexOf('\n')
  const head: unknown = JSON.parse(cut === -1 ? body : body.slice(0, cut))
  const envelope = parseDocumentEnvelope(head)

  if (envelope.version === 1) {
    const legacy = isRecord(head) ? head.content : undefined
    return { ...envelope, content: legacy === undefined ? '' : JSON.stringify(legacy) }
  }

  return { ...envelope, content: cut === -1 ? '' : body.slice(cut + 1) }
}

/** Whether a path is there at all. `stat` would say more than the caller needs. */
async function exists(path: string): Promise<boolean> {
  try {
    await readdir(path)
    return true
  } catch {
    return false
  }
}

/** Node reports a missing path this way, and it is the one failure that is not an error here. */
function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/**
 * The envelope of a file, without reading the document under it: a listing needs a title and a
 * kind, and a project of heavy scenes would otherwise be read whole every time it is opened.
 *
 * A version 1 file has no first line, so its head is truncated and fails to parse; it falls
 * back to the whole file, which is the only way to read one.
 */
async function headOf(file: string): Promise<DocumentEnvelope> {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(ENVELOPE_LIMIT)
    const { bytesRead } = await handle.read(buffer, 0, ENVELOPE_LIMIT, 0)
    const head = buffer.toString('utf8', 0, bytesRead)
    const cut = head.indexOf('\n')
    if (cut !== -1) return parseDocumentEnvelope(JSON.parse(head.slice(0, cut)))
  } finally {
    await handle.close()
  }

  return splitDocument(await readFile(file, 'utf8'))
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

  /**
   * The envelope on its first line, the content on the rest. Concatenated rather than
   * serialized as one object: the content arrives already serialized, and stringifying it again
   * here would put the cost of every document back on the thread that owns every window.
   */
  const bodyOf = (document: DocumentFile): string => {
    const { content, ...envelope } = document
    return `${JSON.stringify(envelope)}\n${content}`
  }

  const store = async (file: string, document: DocumentFile): Promise<void> => {
    // Unique per call: the staging copy of one window must not be the staging copy of another.
    const copy = `${file}.${randomUUID()}${STAGING_SUFFIX}`
    staging.add(basename(copy))

    // The folder is the user's and may have gone since the project was opened; losing a save
    // to a missing folder is worse than an `mkdir` that almost always does nothing.
    await mkdir(dirname(file), { recursive: true })

    try {
      await writeFile(copy, bodyOf(document), 'utf8')
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

  /**
   * A folder document, swapped in whole. The manifest carries what a file document's body
   * carries; the parts sit beside it, under names `isPartName` has cleared — they become paths,
   * so they are checked here rather than trusted from the renderer.
   *
   * Three moves rather than one: `rename` will not replace a folder that has anything in it, so
   * the previous one steps aside before the new one lands, and is removed only once it has. The
   * one it steps aside to is `.old`, which the sweep deliberately leaves alone: a process that
   * dies between the two renames must leave the previous document recoverable by hand, not
   * collected as rubbish.
   */
  const storeFolder = async (folder: string, document: DocumentFile): Promise<void> => {
    const { parts = [], ...rest } = document
    const refused = parts.find(part => !isPartName(part.name))
    if (refused) throw new Error(`Part name ${refused.name} is not a file name`)

    const staged = `${folder}.${randomUUID()}${STAGING_SUFFIX}`
    const stepped = `${folder}.${randomUUID()}.old`
    staging.add(basename(staged))

    try {
      await mkdir(staged, { recursive: true })
      // The manifest holds no parts: they are the folder's own entries, and naming them twice
      // would let the two disagree.
      await writeFile(join(staged, DOCUMENT_MANIFEST), bodyOf(rest), 'utf8')
      for (const part of parts) {
        await writeFile(join(staged, part.name), Buffer.from(part.data, 'base64'))
      }

      const held = await exists(folder)
      if (held) await rename(folder, stepped)
      try {
        await rename(staged, folder)
      } catch (error) {
        // Put back what stepped aside: the window between the two renames is the only moment
        // the document does not exist, and leaving it that way would lose it.
        if (held) await rename(stepped, folder)
        throw error
      }
      if (held) await rm(stepped, { force: true, recursive: true })
    } catch (error) {
      await rm(staged, { force: true, recursive: true })
      throw error
    } finally {
      staging.delete(basename(staged))
    }
  }

  /** Reads a folder document back: its manifest, and every file the renderer left beside it. */
  const readFolder = async (folder: string): Promise<DocumentFile> => {
    const document = splitDocument(await readFile(join(folder, DOCUMENT_MANIFEST), 'utf8'))
    const entries = await readdir(folder)

    const parts: DocumentPart[] = []
    for (const entry of entries) {
      // The manifest is not a part, and anything else in there is not ours: a file the user
      // dropped in the folder is left where it is rather than handed to the editor.
      if (entry === DOCUMENT_MANIFEST || !isPartName(entry)) continue
      parts.push({ name: entry, data: (await readFile(join(folder, entry))).toString('base64') })
    }
    return { ...document, parts }
  }

  /** Swept while listing rather than on a timer: nothing else ever reads that folder. */
  const sweep = async (folder: string, entries: readonly string[]): Promise<void> => {
    // Failure is nothing to report: the listing is what was asked for, and the copy will be
    // offered again at the next open.
    await Promise.all(
      orphanStagingCopies(entries, staging).map(orphan =>
        // `recursive`: a folder document stages a folder, and `rm` refuses one without it.
        rm(join(folder, orphan), { force: true, recursive: true }),
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
      const path = join(folder, entry)
      const envelope = await headOf(FOLDER_KINDS.has(kind) ? join(path, DOCUMENT_MANIFEST) : path)
      // The folder's word beats the file's, exactly as `read` has it: an extension changed by
      // hand must not send a document to an editor that cannot open it.
      if (envelope.kind !== kind) return null

      return { id: basename(entry, extname(entry)), kind, title: envelope.title, workspace }
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
        document = FOLDER_KINDS.has(kind)
          ? await readFolder(file)
          : splitDocument(await readFile(file, 'utf8'))
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
      const document = { ...draft, version: DOCUMENT_VERSION, kind, updatedAt: now() }
      return queued(file, () =>
        FOLDER_KINDS.has(kind) ? storeFolder(file, document) : store(file, document),
      )
    },

    // `force`: closing a document that was never saved must not fail on a file that is absent.
    remove: async (id, kind) => {
      const file = fileOf(id, kind)
      await queued(file, () => rm(file, { force: true, recursive: FOLDER_KINDS.has(kind) }))
    },
  }
}
