import type { WorkspaceId } from './workspace'

/**
 * Document registry, shared by both processes: the native menu will need it for
 * "File ▸ New", and duplicating the type would degrade `DocumentKind` to `string`.
 */
export type DocumentKind = 'image' | 'scene' | 'sequence' | 'audio' | 'skybox'

/** The values beside the type: a file read back off disk has to be checked against them. */
export const DOCUMENT_KINDS: readonly DocumentKind[] = ['image', 'scene', 'sequence', 'audio']

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
}

/** Where a document lives inside its project. Relative: a project folder can be moved. */
export function documentPath(id: string, kind: DocumentKind): string {
  return `${DOCUMENTS_FOLDER}/${id}${EXTENSION_BY_KIND[kind]}`
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
