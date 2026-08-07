import { WORKSPACE_IDS, type WorkspaceId } from './workspace'

/**
 * Document registry, shared by both processes: the native menu will need it for
 * "File ▸ New", and duplicating the type would degrade `DocumentKind` to `string`.
 */
export type DocumentKind = 'image' | 'scene' | 'sequence' | 'audio' | 'skybox'

/** The values beside the type: a file read back off disk has to be checked against them. */
export const DOCUMENT_KINDS: readonly DocumentKind[] = [
  'image',
  'scene',
  'sequence',
  'audio',
  'skybox',
]

export function isDocumentKind(value: unknown): value is DocumentKind {
  return DOCUMENT_KINDS.some(candidate => candidate === value)
}

export type DocumentDescriptor = {
  id: string
  kind: DocumentKind
  title: string
  workspace: WorkspaceId
}

const KIND_BY_WORKSPACE: Record<WorkspaceId, DocumentKind | null> = {
  image: 'image',
  '3d': 'scene',
  video: 'sequence',
  audio: 'audio',
  textures: null,
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

export const DOCUMENT_VERSION = 1

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
 * What an editor hands over to be saved. `content` is whatever that kind serializes — the file
 * layer never reads into it, so a new kind adds no case there.
 */
export type DocumentDraft<C = unknown> = {
  title: string
  content: C
}

/**
 * What a document weighs on disk: a draft under an envelope the file layer stamps itself. The
 * renderer supplies neither — it owns none of these three, and an `updatedAt` from its clock
 * or a `kind` that disagrees with the file name would both be its word against the folder's.
 *
 * `version` is the file format's, not the document's: it is what lets a project written by an
 * older build be migrated rather than refused.
 */
export type DocumentFile<C = unknown> = DocumentDraft<C> & {
  version: number
  kind: DocumentKind
  updatedAt: string
}
