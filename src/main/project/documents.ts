import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'
import {
  documentPath,
  documentFolderOf,
  LEGACY_DOCUMENTS_FOLDER,
  DOCUMENT_VERSION,
  isStagingName,
  isDocumentExtension,
  kindsForExtension,
  STAGING_SUFFIX,
  workspaceForKind,
  type DocumentDescriptor,
  type DocumentDraft,
  type DocumentFile,
  type DocumentKind,
  type DocumentWrite,
} from '@shared/domain/document'
import {
  checkDocumentName,
  documentFileName,
  nextFreeDocumentName,
  type NamedDocument,
} from '@shared/domain/documentName'
import { extensionOf, foldForFileName } from '@shared/domain/fileName'
import { parentOf, pathIn, type FolderEntry } from '@shared/domain/folder'
import { exists, isMissing, writeAtomic } from '@main/persistence'
import { bodyFormatOf, type DocumentHead } from './documentBody'
import { createHeadCache } from './headCache'

export type DocumentFiles = {
  /**
   * Every document of the open project. The folder is what says which ones exist: a registry
   * kept beside it would follow the application rather than the project, and opening another
   * one would show the previous project's tabs.
   */
  list: () => Promise<DocumentDescriptor[]>
  /** `null` when the document has never been saved — an open tab that holds nothing yet. */
  read: (id: string, kind: DocumentKind) => Promise<DocumentFile | null>
  /**
   * `force` is the caller saying the user was asked about an outside change and said yes.
   * `folder` is where a FIRST save lands; a document that already has a file ignores it.
   */
  write: (
    id: string,
    kind: DocumentKind,
    draft: DocumentDraft,
    force?: boolean,
    folder?: string,
  ) => Promise<DocumentWrite>
  remove: (id: string, kind: DocumentKind) => Promise<void>
  /**
   * Gives a document another name, which is also giving its file another name.
   *
   * Rejects rather than suffixing when the folder already holds that name: this is a name the
   * user typed, and handing them a document called something they did not write is worse than
   * saying no. `checkDocumentName` is what says the same thing before the gesture.
   */
  rename: (id: string, kind: DocumentKind, title: string) => Promise<DocumentDescriptor>
}

/**
 * What `rename` throws when the folder already holds the name.
 *
 * Not exported, and nobody imports it across the bridge: what the renderer actually reads is
 * `message.includes('duplicate')` against `DOCUMENT_NAME_FAILURES` (`stores/documents.ts`), so
 * the contract is that this message CONTAINS the shared code, not that it equals this value.
 */
const DUPLICATE_NAME = 'duplicate-name'

/**
 * The staging copies in a folder that nobody is writing any more — the remains of a process
 * that died between the write and the rename, which the `catch` of a failed write never sees.
 *
 * `inFlight` is what keeps a save happening right now from being swept: every window writes
 * through the one main process, so that set is the whole truth about who is holding what. It
 * holds NAMES, as the writer registers them, and the paths come from a walk of the project —
 * two folders may each be staging a copy, and the question is only whether this file is one.
 *
 * Pure, and separate from the sweep itself: `readdir` and `rm` are as testable as any other
 * disk call, which is to say not, and the rule is the part worth being sure of.
 */
function isStagingCopy(path: string, inFlight: ReadonlySet<string>): boolean {
  return isStagingName(path) && !inFlight.has(basename(path))
}

export function orphanStagingCopies(
  paths: readonly string[],
  inFlight: ReadonlySet<string>,
): string[] {
  return paths.filter(path => isStagingCopy(path, inFlight))
}

export type DocumentFilesDeps = {
  projectPath: () => string
  now: () => string
  /**
   * Every file the project folder holds, at any depth — `FolderReader.walk`, handed in rather
   * than walked again here.
   *
   * That walk already carries what a listing needs and what a second one would have to be kept
   * in step with: the depth bound, the refusal to descend into a document written as a folder,
   * and the exclusion of everything under a dot. What is left for this file is which of those
   * entries is a document, which is the only part it knows about.
   */
  walkFiles: () => Promise<readonly FolderEntry[]>
  /**
   * Every name one folder holds, hidden ones included — `FolderReader.names`.
   *
   * The walk above cannot answer for a staging copy of a folder document: it is a directory with
   * no document extension, so the walk neither shows it nor descends into it. This reads the
   * folders documents were actually found in, which is the only place a staging copy can be.
   */
  folderNames: (relative: string) => Promise<readonly string[] | null>
}

/**
 * Whether a path is worth opening for a document envelope — the filter that runs BEFORE any file
 * is opened, and what keeps reading a whole project down to one open per document.
 *
 * An extension the studio writes, or none at all: a document that lost its extension is still
 * one, and reading a head it does not have costs one bounded read of a file the user cannot have
 * many of. Everything else — every `.png`, `.glb`, `.wav` a project is full of — is turned away
 * on its name.
 */
function claimsDocument(path: string): boolean {
  // `extensionOf` and not `extname`: the studio has one spelling of "what is this file's
  // extension", and it exists because three sites had quietly disagreed about `.gitignore`.
  // Over the NAME, since it reads back to the last dot and a folder may hold one.
  const extension = extensionOf(basename(path))
  // A Set rather than `kindsForExtension`, which allocates: this runs once per file of the
  // project, and a hundred thousand of them is a hundred thousand arrays thrown away.
  return extension === '' || isDocumentExtension(extension)
}

/** How many heads are read at once, `documents.bench.ts` being what says whether it still pays:
 * a listing reads one head per document, and the cache under it — `headCache.ts` — is what makes
 * the SECOND listing of an unchanged folder cost nothing at all. */
const HEAD_POOL = 16

/** Runs `read` over `items` with at most `HEAD_POOL` in flight, ANSWERING IN ORDER.
 *
 * The order is not cosmetic: it is what settles which of two files claiming one id keeps it,
 * and that answer has to be the same on every machine. */
export async function pooledHeads<T>(
  items: readonly string[],
  read: (item: string) => Promise<T>,
): Promise<T[]> {
  const done = new Array<T>(items.length)
  let next = 0

  const worker = async (): Promise<void> => {
    for (let index = next++; index < items.length; index = next++) {
      const item = items[index]
      if (item !== undefined) done[index] = await read(item)
    }
  }

  await Promise.all(Array.from({ length: Math.min(HEAD_POOL, items.length) }, worker))
  return done
}

/**
 * What a listing needs of a file, read the cheapest way the format allows — a project of heavy
 * scenes would otherwise be read whole every time it is opened.
 *
 * Every format reads a BOUNDED head now, the two glTF kinds and the montage included — ×4,0 on
 * 5 000 documents of 200 Kio, measured 18/08. What still reads whole is a file written before its
 * id was stamped where the head reaches. `headCache.ts` sits over all of it, and is what makes the
 * second listing of an unchanged folder cost a `stat` and nothing else.
 *
 * Exported for the bench beside it rather than for callers — like `pooledHeads`, and for the same
 * reason: timing a copy of it would time something else.
 */
export async function headOf(file: string): Promise<DocumentHead> {
  return await bodyFormatOf(extensionOf(basename(file))).readHead(file)
}

/**
 * A document as its own file answers for it, and everything reading that answer produced.
 *
 * The three fields are what a caller would otherwise go back to the disk for: `descriptor` is
 * what a listing shows, `body` is the document itself when the format's head IS the whole file,
 * and `time` is the clock taken BEFORE any of it was read — which is the one a save has to be
 * defended by.
 */
type FoundDocument = {
  descriptor: DocumentDescriptor
  body: DocumentFile | null
  time: number
}

/**
 * Documents as files in the project folder — a document is the user's own work, and it has to
 * survive a catalogue rebuilt from that folder.
 */
export function createDocumentFiles({
  projectPath,
  now,
  walkFiles,
  folderNames,
}: DocumentFilesDeps): DocumentFiles {
  /**
   * In-flight work per DOCUMENT, so writing, renaming and removing one cannot interleave.
   *
   * Keyed by id rather than by path, which it was until a document could be renamed: a rename
   * and a save aim at two different paths, so keyed by path they no longer queued behind one
   * another — the autosave would rename its staging copy back over the name the document just
   * left, and the rename would undo itself.
   */
  const pending = new Map<string, Promise<unknown>>()

  /**
   * Where a document sits. A document is no longer named after its id, so this is what says
   * which entry of the folder is which document.
   *
   * Keyed by kind AND id, never by id alone: an id is unique per kind and not across them, and
   * `keeps two kinds of the same id apart` is the case that says so. Keyed by id, writing the
   * image twin displaced the scene twin and the pair came back as one document.
   *
   * A cache and not a registry: `walk` rebuilds it from the folder, which stays the only thing
   * that says what exists. Missing or stale, the answer is one listing away.
   *
   * The value is a path relative to the PROJECT, not a directory entry: a document may sit
   * anywhere now, and a bare entry would have to be resolved against a folder nobody carries.
   */
  const index = new Map<string, string>()

  /**
   * What ONE folder already holds, as a name check needs to see it.
   *
   * Read from the DISK rather than from `index`, and there is one answer to "is this name taken"
   * in the studio rather than two: `filePlan` asks the folder, so this asks the folder. The
   * index is a cache `walk` fills — `rename` already says below that it decides nothing — and
   * this question decides where a file is WRITTEN, where both `writeFile` and `fs.rename`
   * overwrite without a word. One listing out of date is a document lost.
   *
   * Every entry, not only the ones that read back as documents: the disk cannot hold two things
   * of one name, so a `Scène 1.gltf` too damaged to open still takes the name it wears.
   *
   * Keyed by the directory entry, which is all a name check ever needs an id for — telling the
   * document being renamed apart from its own name.
   *
   * Per folder and not across the project: two folders may each hold a `Niveau.gltf` and the
   * disk is happy with both, so a check taken over the whole tree would refuse a name nothing
   * where the document sits answers to.
   */
  const namesIn = async (folder: string): Promise<NamedDocument[]> =>
    ((await folderNames(folder)) ?? []).map(entry => {
      // NFC, because `readdir` answers the bytes the volume stores and the studio composes its
      // own: APFS keeps `Été.gltf` decomposed when that is how it arrived. `checkDocumentName`
      // folds what it COMPARES but exempts the document being renamed by plain equality, so an
      // entry left decomposed would refuse the user their own name — `Été` → `ÉTÉ` answering
      // "already taken", pointing at the very file being renamed.
      const fileName = entry.normalize('NFC')
      return { id: fileName, fileName }
    })

  /**
   * The modification time each FILE carried when the studio last read or wrote it.
   *
   * Held here rather than stamped in the file, and it cannot be otherwise: the write that
   * finishes a file is what sets its time, so no value written inside it can match what the
   * filesystem reports afterwards.
   *
   * Keyed by the absolute path, not by the document. Keyed by id it answered for the wrong file
   * twice over: two projects each holding an old `Level.gltf` share the id `Level`, and a
   * document DUPLICATED in the Finder makes two files answer to one id — the second save then
   * reported the user's own document as changed behind their back, which it was not.
   */
  const seen = new Map<string, number>()

  /**
   * Every head this reader has looked at, kept until its file changes — see `headCache.ts` for
   * what that costs and what it cannot see.
   *
   * It outlives a project, and that is not a leak: `services.ts` builds ONE reader for the life of
   * the process, `projectPath` being a function it follows. Closing a project drops nothing, which
   * is why the key is the absolute path.
   */
  const heads = createHeadCache(headOf)

  const keyOf = (id: string, kind: DocumentKind): string => `${kind}:${id}`

  /** An absolute path back to the spelling every boundary of the studio uses. */
  const relativeOf = (file: string): string => relative(projectPath(), file).split(sep).join('/')

  const absoluteOf = (path: string): string => join(projectPath(), path)

  /** When the file was last written, or `null` when it is not there. */
  const timeOf = async (file: string): Promise<number | null> => {
    try {
      return (await stat(file)).mtimeMs
    } catch (error) {
      if (isMissing(error)) return null
      throw error
    }
  }

  const remember = async (file: string): Promise<void> => {
    const time = await timeOf(file)
    if (time !== null) seen.set(file, time)
  }

  /** Where a document of this id WOULD sit had it never been named — and where a first write goes. */
  const fileOf = (id: string, kind: DocumentKind): string =>
    join(projectPath(), documentPath(id, kind))

  const queued = <T>(id: string, run: () => Promise<T>): Promise<T> => {
    const next = (pending.get(id) ?? Promise.resolve()).then(run, run)
    // Settled either way: a failed operation must not block the document for the rest of the session.
    pending.set(
      id,
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
      // Shared with the three stores of `persistence`, which is also where the tidy-up learned not
      // to become the failure: this copy's `rm` used to throw over the error the caller needed.
      // Durability across a power cut would want `fsync`; it has none.
      const body = bodyFormatOf(extensionOf(basename(file))).write(document)
      await writeAtomic(file, body, { staging: copy })
      heads.forget(file)
    } finally {
      staging.delete(basename(copy))
    }
  }

  /** Swept while listing rather than on a timer: nothing else ever walks the whole folder. */
  const sweep = async (orphans: readonly string[]): Promise<void> => {
    // Failure is nothing to report: the listing is what was asked for, and the copy will be
    // offered again at the next open.
    await Promise.all(
      // `recursive`: a folder document stages a folder, and `rm` refuses one without it.
      orphans.map(orphan => rm(absoluteOf(orphan), { force: true, recursive: true })),
    )
  }

  /**
   * A document read off its path, or nothing — with everything that read produced along the way.
   *
   * `body` and `time` are the reason this is not just a descriptor. A montage carries no head of
   * ours, so finding out what it IS reads and parses the whole of it; handing that back is what
   * keeps an open from paying for the same parse twice, and a rename four times.
   */
  const foundAt = async (path: string): Promise<FoundDocument | null> => {
    const entry = basename(path)
    const extension = extensionOf(entry)
    const claimed = kindsForExtension(extension)
    // An entry with no extension at all claims nothing, so there is nothing for the envelope to
    // contradict — and one that lost its extension is a document the studio would otherwise stop
    // seeing altogether: present in the folder, absent from every list, and unopenable. Reading
    // a head it does not have costs one bounded read, which is what `claimsDocument` bounds.
    if (claimed.length === 0 && extension !== '') return null

    try {
      const file = absoluteOf(path)
      const { envelope, body, time } = await heads.read(file)
      // The file says which kind it is, BOUNDED by what its extension could name: a container
      // serving two editors cannot be told apart by its name, and trusting the head outright
      // would send a `.gltf` whose envelope reads `texture` to the material editor.
      if (claimed.length > 0 && !claimed.includes(envelope.kind)) return null

      const workspace = workspaceForKind(envelope.kind)
      if (!workspace) return null

      const stem = basename(entry, extension)

      return {
        descriptor: {
          // Before version 3 the file name WAS the id, so that is what such a document is still
          // called — its tabs, its place in the layout and its recent entry all say so.
          id: envelope.id ?? stem,
          kind: envelope.kind,
          // The file name is the title, and has been since documents came to be named by hand.
          // Falling back on it rather than refusing an envelope that lost its own: a document
          // with no title would drop out of every listing while sitting in the folder.
          title: envelope.title || stem,
          workspace,
          path,
          ...(envelope.sourceAssetId ? { sourceAssetId: envelope.sourceAssetId } : {}),
        },
        body,
        time,
      }
    } catch {
      // One unreadable document must not cost the user the listing of all the others.
      return null
    }
  }

  const descriptorOf = async (path: string): Promise<DocumentDescriptor | null> =>
    (await foundAt(path))?.descriptor ?? null

  /**
   * The PROJECT, read once: every document it holds, wherever the user put it.
   *
   * One walk, then the heads. The walk is the folder reader's — depth bound, no descent into a
   * document written as a folder, nothing under a dot — and what it answers is filtered by
   * extension BEFORE a single file is opened, which is what makes reading a whole project cost
   * one open per document rather than one per file.
   *
   * Two files can claim the same id — a document duplicated in the Finder carries the id of the
   * one it was copied from. The first in path order keeps it and the second is called after its
   * own path, which is unique by construction: dropping it instead would leave a file plainly
   * sitting in the folder and absent from every list in the studio.
   */
  const walk = async (): Promise<DocumentDescriptor[]> => {
    // One pass over the walk, not three. A project of a hundred thousand files is a hundred
    // thousand strings, and this runs on the thread that owns every window — mapping them to
    // paths, then filtering for staging copies, then filtering again for documents was three
    // uninterrupted blocks where one loop answers both questions.
    const candidates: string[] = []
    const orphans: string[] = []

    for (const { path } of await walkFiles()) {
      if (claimsDocument(path)) candidates.push(path)
      else if (isStagingCopy(path, staging)) orphans.push(path)
    }

    /**
     * A folder document stages a FOLDER — `Planche.img.<uuid>.tmp` — and the walk answers files
     * and documents, so it never shows one. Its own folder is read for it: the folders documents
     * were found in, which is where the writer puts them and the only place one can be.
     *
     * Read once the candidates are known, so it costs one `readdir` per folder actually holding
     * a document — one or two in an ordinary project — rather than a second walk.
     */
    const folders = new Set(candidates.map(path => parentOf(path) ?? ''))
    folders.add(LEGACY_DOCUMENTS_FOLDER)

    const staged = await Promise.all(
      [...folders].map(async folder => {
        const names = (await folderNames(folder)) ?? []
        return names.map(name => pathIn(folder, name)).filter(path => isStagingCopy(path, staging))
      }),
    )

    await sweep([...orphans, ...staged.flat()])

    index.clear()

    // By code unit, and said so: this ordering reaches no reader — it only settles WHICH of two
    // files claiming one id keeps it, and that answer has to be the same on every machine.
    candidates.sort((one, other) => (one < other ? -1 : one > other ? 1 : 0))

    const found: DocumentDescriptor[] = []
    for (const descriptor of await pooledHeads(candidates, descriptorOf)) {
      if (!descriptor) continue

      const claimed = index.has(keyOf(descriptor.id, descriptor.kind))
      const id = claimed ? descriptor.path : descriptor.id
      index.set(keyOf(id, descriptor.kind), descriptor.path)
      found.push(claimed ? { ...descriptor, id } : descriptor)
    }
    return found
  }

  /**
   * The entry a document is written to, or the address it would have had — TOGETHER with what
   * checking that entry read out of it.
   *
   * The cached answer is checked rather than trusted: the folder is the user's, and a document
   * renamed in the Finder would otherwise be written to a path that is no longer there — which
   * `writeFile` answers by creating it, leaving two files where the user made one.
   *
   * That check is a full read for a format with no head of ours, so its result is HANDED BACK
   * rather than dropped: an open used to verify the file and then read it again, and a rename
   * did it four times over. `found` is `null` for the fallback address alone — nothing sits
   * there, so there was nothing to read.
   */
  const locate = async (
    id: string,
    kind: DocumentKind,
  ): Promise<{ file: string; found: FoundDocument | null }> => {
    /**
     * Whether the file at this path IS the document being asked for.
     *
     * `path === id` is the second document of a duplicated pair: `walk` gives it its own path
     * for an id, its envelope still answering the id it was copied from — so an equality on the
     * envelope alone rejected it, and every gesture fell through to the address it WOULD have
     * had. Listed, and unopenable: a double-click gave an empty tab and the next ⌘S wrote that
     * emptiness under `documents/<the whole path>.gltf`.
     *
     * No id can collide with a path: one is a uuid or the stem of a pre-version-3 file, and a
     * path carries the extension the stem drops.
     */
    const holding = async (path: string): Promise<FoundDocument | null> => {
      const found = await foundAt(path)
      if (!found || found.descriptor.kind !== kind) return null
      return found.descriptor.id === id || path === id ? found : null
    }

    const cached = index.get(keyOf(id, kind))
    if (cached) {
      const found = await holding(cached)
      if (found) return { file: absoluteOf(cached), found }
    }

    // A folder that cannot be read answers "not found" rather than throwing: whatever is wrong
    // with it, the caller is about to touch it and will fail with its OWN error, which is the
    // one worth reporting — a `documents` that is a file must say `mkdir`, not `scandir`.
    try {
      await walk()
    } catch {
      return { file: fileOf(id, kind), found: null }
    }

    const listed = index.get(keyOf(id, kind))
    if (listed) {
      const found = await holding(listed)
      if (found) return { file: absoluteOf(listed), found }
    }

    // Never listed, so never written: a document saved for the first time is named after itself
    // by `write`, and this is only what `read` and `remove` ask about before that happens.
    return { file: fileOf(id, kind), found: null }
  }

  /**
   * Where a document written for the first time goes: under its own name, in the folder its
   * author picked. The kind's own folder is the fallback for a caller that names none — a
   * default, not where documents live: they live wherever the user put them, which is what
   * `walkFiles` finds.
   *
   * Suffixed rather than refused when the folder already holds that name — this is the studio
   * naming a document nobody has named yet ("Scène 2", the title of an asset opened twice),
   * and there is no one to ask. A name the USER typed is refused instead, by `rename`.
   *
   * One `readdir` of the landing folder, which is what a first save can afford — and the only
   * answer worth having: this path is handed straight to a write that overwrites what it lands
   * on, and nothing else stands between the two.
   */
  const freshFile = async (
    kind: DocumentKind,
    title: string,
    folder = documentFolderOf(kind),
  ): Promise<string> => {
    const taken = await namesIn(folder)
    return join(
      absoluteOf(folder),
      documentFileName(nextFreeDocumentName(title, kind, taken), kind),
    )
  }

  /** The bytes under a file, put back into a document — or nothing, for a file that is not there. */
  const bodyAt = async (
    file: string,
    kind: DocumentKind,
    id: string,
  ): Promise<DocumentFile | null> => {
    let document: DocumentFile
    try {
      document = bodyFormatOf(extensionOf(basename(file))).read(await readFile(file))
    } catch (error) {
      if (isMissing(error)) return null
      throw error
    }

    // The file must still be what the caller was listed: a document copied to another extension
    // by hand would otherwise open in the wrong editor, with the wrong content.
    if (document.kind !== kind) {
      throw new Error(`Document ${id} holds a ${document.kind}, not a ${kind}`)
    }
    return document
  }

  async function readOne(id: string, kind: DocumentKind): Promise<DocumentFile | null> {
    const { file, found } = await locate(id, kind)

    // BEFORE the read, never after. A file rewritten while it is being read would otherwise be
    // remembered by the time of a write whose bytes never reached this state — and the next ⌘S
    // would find the times agreeing and overwrite it. Taken first, the error leans the safe way:
    // the studio believes the file older than it is, and asks.
    //
    // `found.time` was taken before its own head read, so it is that same instant or earlier.
    if (found) seen.set(file, found.time)
    else await remember(file)

    return found?.body ?? (await bodyAt(file, kind, id))
  }

  return {
    list: walk,

    read: (id, kind) => queued(id, () => readOne(id, kind)),

    write: (id, kind, draft, force = false, folder) =>
      queued(id, async () => {
        // A document already on disk keeps the file it is in — including one written before
        // version 3, still under the uuid it was named after. Renaming those is the user's
        // gesture, not something a save does behind them. `folder` is read here and nowhere
        // else, which is what makes a chosen folder a placement rather than a move.
        const { file: located } = await locate(id, kind)
        const onDisk = await exists(located)
        const file = onDisk ? located : await freshFile(kind, draft.title, folder)

        // A document the studio has no clock for is one it cannot claim to have written, so it
        // is not defended — and nothing is stat'd for it either.
        const known = onDisk && !force ? seen.get(file) : undefined
        if (known !== undefined && (await timeOf(file)) !== known) return 'stale'

        // Stamped here rather than taken from the draft: the renderer owns none of these, and
        // an id from its side would be its word against the folder's.
        const document = { ...draft, version: DOCUMENT_VERSION, kind, updatedAt: now(), id }

        await store(file, document)
        // The head kept for this file is now a description of bytes that are gone. Dropped
        // rather than left to the clock: a save landing in the same millisecond at the same
        // size is the one case `mtimeMs` cannot tell apart, and it is the studio's own writes
        // that come that fast.
        heads.forget(file)
        index.set(keyOf(id, kind), relativeOf(file))
        await remember(file)
        return 'written'
      }),

    rename: (id, kind, title) =>
      queued(id, async () => {
        const { file: from, found } = await locate(id, kind)
        // A rename stays where the document IS. Landing it in `documents/` would move it behind
        // the user's back, and the folder they filed it in is the one the name has to be free in.
        const inFolder = parentOf(relativeOf(from)) ?? ''

        const taken = await namesIn(inFolder)

        // The failure travels as the message, so the window says which of the four it was rather
        // than reporting every refusal as a name already taken. The document's own entry is
        // exempted by the name it wears, which is what the folder knows it by.
        // Composed on this side too: `from` is built from the index, and the folder listing above
        // is composed on the way in — the exemption is an equality, so the two have to be spelt
        // the same way.
        const refused = checkDocumentName(title, kind, taken, basename(from).normalize('NFC'))
        if (refused) throw new Error(refused)

        const entry = documentFileName(title, kind)
        const path = inFolder === '' ? entry : `${inFolder}/${entry}`
        const to = absoluteOf(path)

        // What `locate` already read, rather than a second look at the same file: this was the
        // second of four reads a rename cost a montage.
        if (!found) throw new Error(`Document ${id} is not there to rename`)
        // `id` and not `descriptor.id`: a duplicated document is known by its PATH while its
        // envelope still answers the id it was copied from, and the rename stamps the one the
        // caller holds. Answering with the envelope's would hand back a document nobody asked for.
        const descriptor = { ...found.descriptor, id }
        if (to === from) return { ...descriptor, title, path }

        /**
         * Asked before renaming, because `fs.rename` overwrites without a word on POSIX — and
         * replaces an empty directory without one either, which is what an untouched `.ora` is.
         * `checkDocumentName` above asks the same folder the same thing, and this is kept anyway:
         * it is the answer nearest the syscall that overwrites, and one `stat` is a cheap price
         * for the window between a listing and a rename.
         *
         * Except when it is THIS document answering: `Niveau` → `niveau` is the plainest rename
         * there is, and on APFS and NTFS the file it would land on is the one it is leaving —
         * so the disk says "taken" and the user is told their own document is in the way.
         */
        const sameFile = foldForFileName(entry) === foldForFileName(basename(from))
        if (!sameFile && (await exists(to))) throw new Error(DUPLICATE_NAME)

        // The envelope FIRST, the move second. A crash between the two leaves the right title in
        // a file under the old name, and the name is derived from the title — so the next open
        // reads the document correctly and only its file lags, which renaming again repairs. The
        // other order leaves a file whose name says one thing and whose envelope says another:
        // the two names this whole change exists to collapse into one.
        const held = found?.body ?? (await bodyAt(from, kind, id))
        if (!held) throw new Error(`Document ${id} is not there to rename`)

        // `parts` comes along, and the whole picture rides on that word: the container is
        // rewritten from this object, so leaving them out writes a stack with no surfaces under
        // it — every layer of the document gone, silently, on a rename. They were dropped here
        // while an image was a FOLDER and its parts were the folder's own entries.
        const renamed: DocumentFile = {
          ...held,
          title,
          id,
        }

        // A document that GAINS an extension is written straight to its new name, and the old
        // file removed after. The bytes are spelt for the name they land under, so a move that
        // failed between the two would otherwise leave a body under a name that denies it — the
        // very loss this spelling exists to prevent. The extension is the same either way in
        // every other rename, `descriptorOf` refusing a file whose head its name denies, and
        // there the envelope-then-move order stands: a crash leaves the right title under the
        // old name, which renaming again repairs.
        if (extensionOf(basename(from)) !== extensionOf(entry)) {
          await store(to, renamed)
          await rm(from, { force: true })
        } else {
          await store(from, renamed)
          await rename(from, to)
        }
        // Both names, for the same reason `write` drops one: the file under `from` is gone and
        // the one under `to` was written by the studio a moment ago.
        heads.forget(from)
        heads.forget(to)
        index.set(keyOf(id, kind), path)
        // The envelope was just rewritten and the file just moved, both by the studio. Without
        // this, the next ⌘S would read a time it does not recognise and accuse the user of
        // having edited their own document elsewhere.
        await remember(to)
        // The file under `from` no longer exists, and its clock would answer for whatever lands
        // there next.
        seen.delete(from)

        return { ...descriptor, title, path }
      }),

    // `force`: closing a document that was never saved must not fail on a file that is absent.
    remove: async (id, kind) => {
      await queued(id, async () => {
        const { file, found } = await locate(id, kind)
        // Refused only for a file that demonstrably belongs to something ELSE. `locate` falls
        // back on the address a document WOULD have had, and two kinds share an extension — so
        // that address is the same for both, and an id that happens to be another document's
        // file name would have that document removed instead.
        //
        // One that answers nothing is still removed, which is what a file that is not there has
        // always been. **The blind spot is `locate`, not this**: a document whose envelope
        // stopped reading cannot be found at all, so removal lands on the address it would have
        // had and the real file stays — invisible in every list and undeletable from the studio.
        //
        // A `found` needs no second opinion: `locate` has already established that this file IS
        // the document asked for. Asking its DESCRIPTOR again would refuse a duplicated document
        // — its envelope answers the id it was copied from, never the path it is known by.
        const sitting = found ? null : await descriptorOf(relativeOf(file))
        if (found || !sitting || (sitting.id === id && sitting.kind === kind)) {
          await rm(file, { force: true })
        }
        heads.forget(file)
        index.delete(keyOf(id, kind))
        seen.delete(file)
      })
    },
  }
}
