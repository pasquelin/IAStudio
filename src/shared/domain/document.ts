import type { OraSurface } from './openRaster'
import { WORKSPACE_IDS, type WorkspaceId } from './workspace'

/**
 * Document registry, shared by both processes: the native menu will need it for
 * "File ▸ New", and duplicating the type would degrade `DocumentKind` to `string`.
 */
export type DocumentKind = 'image' | 'scene' | 'sequence' | 'audio' | 'skybox' | 'texture'

/** The values beside the type: a file read back off disk has to be checked against them. */
export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  'image',
  'scene',
  'sequence',
  'audio',
  'skybox',
  'texture',
]

export function isDocumentKind(value: unknown): value is DocumentKind {
  return DOCUMENT_KINDS.some(candidate => candidate === value)
}

export type DocumentDescriptor = {
  /**
   * Never shown. It used to BE the file name, so a folder of documents read as a folder of
   * uuids — and renaming one gave the document a new identity, which is why renaming an open
   * one had to be forbidden. It now lives in the envelope and survives being renamed.
   */
  id: string
  kind: DocumentKind
  title: string
  workspace: WorkspaceId
  /**
   * Where this document was read from, relative to the project folder, extension included —
   * `Repérages/Niveau.gltf`. The same spelling every other path on this boundary uses, `/` on
   * every platform.
   *
   * The whole path and not the entry alone, since a document may sit anywhere in the project:
   * two folders may each hold a `Niveau.gltf`, and a listing joined on the name would hand the
   * explorer one document's descriptor for the other one's row.
   *
   * Carried because the id no longer spells it: whoever joins a folder listing to a document has
   * only the path to go on, and rebuilding it from the title would be a second answer free to
   * disagree with the disk.
   */
  path: string
  /**
   * The asset this document was opened to edit, when it was opened for one.
   *
   * What tells "the image document that is open" from "the document OF this image": a
   * double-click on an asset must come back to its own tab rather than pile a second copy into
   * whichever tab happens to be of the right kind.
   */
  sourceAssetId?: string
}

const KIND_BY_WORKSPACE: Record<WorkspaceId, DocumentKind | null> = {
  image: 'image',
  '3d': 'scene',
  video: 'sequence',
  audio: 'audio',
  textures: 'texture',
  skyboxes: 'skybox',
}

/** `null` for a workspace whose editor does not exist yet — the new-document button disables. */
export function kindForWorkspace(workspace: WorkspaceId): DocumentKind | null {
  return KIND_BY_WORKSPACE[workspace]
}

/**
 * The workspace a document belongs to. Searched rather than tabulated: a second table would be
 * free to disagree with the first, and a document filed under a workspace that does not open it
 * is a tab nothing can render.
 *
 * `null` while a kind exists without an editor — the same half-open state `kindForWorkspace`
 * describes, read the other way round.
 */
export function workspaceForKind(kind: DocumentKind): WorkspaceId | null {
  return WORKSPACE_IDS.find(workspace => KIND_BY_WORKSPACE[workspace] === kind) ?? null
}

/**
 * 3 since the envelope carries the document's `id` — which is what let the file be named after
 * the document instead of after a uuid. A file written by version 2 is still read: its id is its
 * file name, exactly as it was. Version 1 is still read too, its whole body being one JSON
 * object, content included.
 */
export const DOCUMENT_VERSION = 3

export const DOCUMENTS_FOLDER = 'documents'

/**
 * The extension each kind reads and writes. A project folder is meant to be read by eye and
 * repaired by hand, and `a3f1.json` beside `b204.json` says nothing about what either is.
 *
 * No spelling of the studio's own is left: every kind names the open format it belongs in. **Only
 * the two montages have the BYTES to match** — the other four still hold the studio's envelope
 * under an open name, so no other application opens one of them yet.
 *
 * Exported so a test can hold it against `DOCUMENT_KINDS`: the compiler makes this table
 * complete, but nothing makes that list complete, and a kind missing from it would be refused
 * at the IPC boundary without a word.
 */
export const EXTENSIONS_BY_KIND: Record<DocumentKind, string> = {
  image: '.ora',
  scene: '.gltf',
  sequence: '.otio',
  // The same montage as a sequence, so the same standard file. Which workspace wrote it is read
  // out of the file's own studio metadata — see `documentBody.ts`, the extension cannot say.
  audio: '.otio',
  // Held in the same container as the scene, for the same reason: a sky is an environment, and
  // glTF is what carries one. The file says which of the two it is.
  skybox: '.gltf',
  texture: '.mtlx',
}

/**
 * Where a document of this id WOULD live had it never been named — which is where one written
 * before version 3 still lives, its file having been called after its id. Relative: a project
 * folder can be moved.
 *
 * NOT where a document lives in general: it is named after itself now and filed wherever the user
 * put it, so what says where one sits is its descriptor's `path`, read off the walk. This is only
 * the folder a first save falls back to.
 */
export function documentPath(id: string, kind: DocumentKind): string {
  return `${DOCUMENTS_FOLDER}/${id}${EXTENSIONS_BY_KIND[kind]}`
}

/**
 * What a file name says the document is, read the other way round from `EXTENSIONS_BY_KIND`.
 * Listing a project folder needs it: the folder is what says which documents exist, and the
 * extension is all a directory entry carries.
 *
 * `null` for anything else in there — a stray note, an export, a staging copy.
 *
 * **Two pairs share a spelling** — the two montages under `.otio`, the scene and the sky under
 * `.gltf` — so this answers the first of each and the FILE settles it: the format declares
 * `kindFromHead`, and `documentBody.ts` reads which kind out of what the file itself carries.
 *
 * Case-sensitive on purpose: `documentPath` writes the extension in lower case, so a `.IMG`
 * accepted here would be listed under a name that `read` then fails to find on a case-sensitive
 * volume — an empty document, and a second file beside the first at the next save.
 */
export function kindForExtension(extension: string): DocumentKind | null {
  return kindsForExtension(extension)[0] ?? null
}

/**
 * EVERY kind this extension could name — one for most, two where a container serves two editors.
 * What a file's own head is allowed to claim: `.gltf` may say scene or sky, and nothing else.
 *
 * Reading the head is what settles it, and this is what bounds that reading. Trusting the head
 * outright would let an envelope reading `texture` open a `.gltf` in the material editor.
 */
export function kindsForExtension(extension: string): readonly DocumentKind[] {
  return DOCUMENT_KINDS.filter(kind => EXTENSIONS_BY_KIND[kind] === extension)
}

/**
 * Whether any kind is held under this extension — the same question without the array, for the
 * one caller that asks it of EVERY file in the project before a single one is opened.
 */
const DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set(Object.values(EXTENSIONS_BY_KIND))

export const isDocumentExtension = (extension: string): boolean =>
  DOCUMENT_EXTENSIONS.has(extension)

/**
 * What an editor hands over to be saved. `content` is already serialized, and that is the whole
 * point: the file layer never reads into it, so it never pays for it either. `JSON.parse` of a
 * scene of twenty thousand nodes is synchronous, and the main process owns every window.
 *
 * Every space already serializes to a string — `serializeScene`, `serializeCanvas`,
 * `serializeSequence` — so this is the form they were in anyway.
 *
 * The empty string means a document that holds nothing yet: a tab opened and not typed in.
 */
export type DocumentDraft = {
  title: string
  content: string
  /**
   * Carried into the file so the link survives the tab: a document reopened next session still
   * knows which asset it edits, which is what a save back onto that asset will read.
   */
  sourceAssetId?: string
  /**
   * The surfaces the container holds beside the stack, for a document one string cannot hold.
   * An image keeps one PNG per layer: the pixels live on the GPU, never in the state, so
   * `content` can only name them.
   *
   * `OraSurface.path` becomes an entry the studio writes AND reads back, so it is checked rather
   * than trusted — `isOraSurfacePath`. It is the one field of this contract crossing a security
   * boundary.
   *
   * Absent for every kind that fits in a string, which is all of them but the image.
   */
  parts?: readonly OraSurface[]
}

/** The suffix on a copy being written, before the rename that makes it the document. */
export const STAGING_SUFFIX = '.tmp'

/**
 * A staging copy of OURS, and only ours: `<file>.<uuid>.tmp`. The project folder is the user's
 * own, and a `render.tmp` they left in there is not something to delete on their behalf.
 *
 * Here rather than beside the writer because two readers need it and neither owns the other: the
 * listing sweeps these away, and the folder walk leaves them out of what it offers.
 */
export function isStagingName(name: string): boolean {
  return STAGING_PATTERN.test(name)
}

const STAGING_PATTERN = /\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.tmp$/i

/**
 * What a document weighs on disk: a draft under an envelope the file layer stamps itself. The
 * renderer supplies neither — it owns none of these three, and an `updatedAt` from its clock
 * or a `kind` that disagrees with the file name would both be its word against the folder's.
 *
 * `version` is the file format's, not the document's: it is what lets a project written by an
 * older build be migrated rather than refused.
 *
 * On disk, the envelope is the first line and the content is everything after it:
 *
 * ```
 * {"version":2,"kind":"scene","title":"Level","updatedAt":"2026-08-07T…"}
 * {"nodes":[…]}
 * ```
 *
 * Two lines rather than one object, so that listing a project reads a short head per file
 * instead of parsing every document in it — and a folder still reads by eye.
 */
export type DocumentFile = DocumentDraft & {
  version: number
  kind: DocumentKind
  updatedAt: string
  /**
   * Who this document is, told by the document rather than by where it sits.
   *
   * Optional because a file written before version 3 has none: there, the file name WAS the id,
   * and `descriptorOf` still reads it that way. Stamped by the main process on the next write,
   * which is what lets a document be renamed without becoming a different document — the layout,
   * the recent list and every open tab are keyed by this.
   */
  id?: string
}

/** The envelope alone, which is all a listing needs. */
export type DocumentEnvelope = Omit<DocumentFile, 'content'>

/**
 * The three answers to closing a document that has unsaved work. `cancel` is the safe one, so
 * it is what a dismissed dialog gives back — a tab must never close because a key was struck.
 */
export type CloseChoice = 'save' | 'discard' | 'cancel'

/**
 * What a write did, and the reason it is not a `void`.
 *
 * `stale` says the file changed under the studio since it was last read or written — another
 * application, or a sync service bringing a different copy back. Writing anyway destroys that
 * work without a word: the window asks, and writes again with `force` if the user says so.
 *
 * The freshness is held by the main process rather than stamped in the file, and it cannot be
 * otherwise: a file's modification time is set by the write that finishes it, so no value
 * written INSIDE it can ever match what the filesystem then reports.
 */
export type DocumentWrite = 'written' | 'stale'

/**
 * How much of a file the envelope may take. It holds a capped title and three short fields; a
 * head longer than this is not one, and reading further would be reading the document itself.
 */
export const ENVELOPE_LIMIT = 8 * 1024
