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
   * The directory entry this document was read from, extension included — `Niveau.scene`.
   *
   * Carried because the id no longer spells it: whoever joins a folder listing to a document
   * has only the entry to go on, and rebuilding it from the title would be a second answer free
   * to disagree with the disk.
   */
  fileName: string
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
 * One extension per kind, as spec § 5 names them. A project folder is meant to be read by eye
 * and repaired by hand, and `a3f1.json` beside `b204.json` says nothing about what either is.
 *
 * Exported so a test can hold it against `DOCUMENT_KINDS`: the compiler makes this table
 * complete, but nothing makes that list complete, and a kind missing from it would be refused
 * at the IPC boundary without a word.
 */
export const EXTENSION_BY_KIND: Record<DocumentKind, string> = {
  image: '.img',
  scene: '.scene',
  sequence: '.seq',
  audio: '.aud',
  skybox: '.sky',
  texture: '.tex',
}

/** Where a document lives inside its project. Relative: a project folder can be moved. */
export function documentPath(id: string, kind: DocumentKind): string {
  return `${DOCUMENTS_FOLDER}/${id}${EXTENSION_BY_KIND[kind]}`
}

/**
 * What a file name says the document is, read the other way round from `EXTENSION_BY_KIND`.
 * Listing a project folder needs it: the folder is what says which documents exist, and the
 * extension is all a directory entry carries.
 *
 * `null` for anything else in there — a stray note, an export, a staging copy.
 *
 * Case-sensitive on purpose: `documentPath` writes the extension in lower case, so a `.IMG`
 * accepted here would be listed under a name that `read` then fails to find on a case-sensitive
 * volume — an empty document, and a second file beside the first at the next save.
 */
export function kindForExtension(extension: string): DocumentKind | null {
  return DOCUMENT_KINDS.find(kind => EXTENSION_BY_KIND[kind] === extension) ?? null
}

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
   * The files that go beside the content, for a document one string cannot hold. An image keeps
   * one PNG per layer: the pixels live on the GPU, never in the state, so `content` can only
   * name them.
   *
   * Absent for every kind that fits in a string, which is all of them but the image.
   */
  parts?: readonly DocumentPart[]
}

/**
 * One file beside a document's content. `data` is base64 — the renderer has no filesystem, and
 * bytes are what it has.
 *
 * `name` is turned into a path by the main process, so it is checked there rather than trusted:
 * see `isPartName`. It is the one field of this contract that crosses a security boundary.
 */
export type DocumentPart = {
  name: string
  data: string
}

/**
 * Which kinds are written as a folder rather than a single file. `parts` is what makes it
 * necessary: a document with files beside it needs somewhere to put them, and `<id>.img/` keeps
 * them together — inspectable, and removable in one gesture.
 */
export const FOLDER_KINDS: ReadonlySet<DocumentKind> = new Set<DocumentKind>(['image'])

/** The manifest inside a folder document, holding exactly what a file document's body holds. */
export const DOCUMENT_MANIFEST = 'document.json'

/**
 * Whether a part may become a file name. Deliberately narrow: the renderer picks these, and a
 * `../` or an absolute path would write wherever it pleased. Letters, digits, dot, dash and
 * underscore only — no separator can be spelled with those, so no traversal can either.
 *
 * `document.json` is refused: a part must never stand where the manifest goes.
 */
export function isPartName(name: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(name) && name !== DOCUMENT_MANIFEST
}

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
 * How much of a file the envelope may take. It holds a capped title and three short fields; a
 * head longer than this is not one, and reading further would be reading the document itself.
 */
export const ENVELOPE_LIMIT = 8 * 1024
