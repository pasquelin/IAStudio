import { isAbsolute } from 'node:path'
import { z } from 'zod'
import {
  ASSET_TYPES,
  isAssetType,
  isSyncStatus,
  type AssetQuery,
  type AssetType,
  type SyncStatus,
} from '@shared/domain/asset'
import {
  DOCUMENT_VERSION,
  isDocumentKind,
  type DocumentDraft,
  type DocumentEnvelope,
  type DocumentKind,
} from '@shared/domain/document'
import type { Manifest } from '@shared/domain/project'
import type { SaveAudioRequest } from '@shared/ipc'

const manifest = z.object({
  version: z.number().int().min(1),
  name: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

/** A project folder is user territory: its manifest can be edited, truncated or replaced. */
export function parseManifest(value: unknown): Manifest {
  return manifest.parse(value)
}

// Absolute paths only, and enforced rather than merely intended: a relative one would resolve
// against the main process's working directory, which is wherever Electron happened to be
// launched from — so `project:open('..')` would reach a folder nobody chose.
const projectPath = z.string().trim().min(1).refine(isAbsolute)

// One name inside one folder. Anything that would create a nested folder, or escape into one,
// is not one — and both users of this come from the renderer and end up in a `join`.
const pathSegment = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(value => !/[/\\]/.test(value) && value !== '.' && value !== '..')

export function parseProjectPath(value: unknown): string {
  return projectPath.parse(value)
}

export function parseProjectName(value: unknown): string {
  return pathSegment.parse(value)
}

// `z.custom` rather than `z.enum`: the values live in `shared/domain/asset.ts`, and zod's enum
// wants a literal tuple, which the project's ban on `as const` rules out.
const assetQuery = z.object({
  type: z.custom<AssetType>(isAssetType).optional(),
  // What a workspace asks for. Bounded by the number of kinds there are: a longer list is a
  // caller that has lost track of what it wants.
  types: z.array(z.custom<AssetType>(isAssetType)).max(ASSET_TYPES.length).optional(),
  tags: z.array(z.string().min(1)).max(32).optional(),
  text: z.string().max(200).optional(),
  location: z.enum(['local', 'cloud']).optional(),
  syncStatus: z.custom<SyncStatus>(isSyncStatus).optional(),
  groupId: z.string().trim().min(1).optional(),
  // Bounded here rather than in SQL: the renderer chooses the page size, and an unbounded
  // one would pull an entire well-stocked project across the IPC boundary in one message.
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
})

export function parseAssetQuery(value: unknown): AssetQuery {
  return assetQuery.parse(value)
}

const assetId = z.string().trim().min(1)

export function parseAssetId(value: unknown): string {
  return assetId.parse(value)
}

// An edited take crosses the boundary as bytes. Bounded rather than trusted: the renderer is
// the sandboxed side, and an unbounded buffer written to disk is a full partition away.
const MAX_AUDIO_BYTES = 512 * 1024 * 1024

const saveAudio = z.object({
  replaces: assetId.optional(),
  name: z.string().trim().min(1).max(200),
  derivedFrom: assetId.optional(),
  wav: z.instanceof(Uint8Array).refine(bytes => bytes.byteLength <= MAX_AUDIO_BYTES),
})

export function parseSaveAudio(value: unknown): SaveAudioRequest {
  return saveAudio.parse(value)
}

export function parseDocumentId(value: unknown): string {
  return pathSegment.parse(value)
}

const documentKind = z.custom<DocumentKind>(isDocumentKind)

export function parseDocumentKind(value: unknown): DocumentKind {
  return documentKind.parse(value)
}

const title = z.string().max(200)

/*
 * Never inspected, and now never parsed either: what a kind stores is its editor's business,
 * and it crosses this boundary as the string that editor serialized.
 *
 * Bounded all the same. The renderer is the sandboxed side, and a document is written to the
 * user's disk: an unbounded string is a full partition away.
 */
const MAX_CONTENT_BYTES = 256 * 1024 * 1024

const content = z.string().max(MAX_CONTENT_BYTES)

const documentDraft = z.object({ title, content })

export function parseDocumentDraft(value: unknown): DocumentDraft {
  return documentDraft.parse(value)
}

const documentEnvelope = z.object({
  // Capped, not merely floored: a file written by a later build must be refused rather than
  // read as if it were this one and silently flattened by the next save.
  version: z.number().int().min(1).max(DOCUMENT_VERSION),
  kind: documentKind,
  title,
  updatedAt: z.string().min(1),
})

/** A document file is user territory, like the manifest: hand-edited, truncated, or older. */
export function parseDocumentEnvelope(value: unknown): DocumentEnvelope {
  return documentEnvelope.parse(value)
}
