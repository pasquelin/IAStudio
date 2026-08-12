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
import { MANIFEST_VERSION, type Manifest } from '@shared/domain/project'
import { isPbrChannel, type PbrChannel } from '@shared/domain/texture'
import type { SaveAudioRequest, SavePictureRequest, SaveTextureRequest } from '@shared/ipc'
import { pathSegment } from '@main/validation'
import { base64Payload } from '@main/scenario/validation'

const manifest = z.object({
  // Capped, not merely floored, exactly as `documentEnvelope` below — and for a heavier reason.
  // A document flattened by a later save is one file; a project is the whole folder.
  version: z.number().int().min(1).max(MANIFEST_VERSION),
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

export function parseProjectPath(value: unknown): string {
  return projectPath.parse(value)
}

export function parseProjectName(value: unknown): string {
  return pathSegment.parse(value)
}

/**
 * A path inside the project, as the explorer asks for it: `''` for the root, then segments
 * joined by `/`. Never absolute, never a `.` or `..` segment, never a backslash.
 *
 * The refusal is the point, not the shape. This is the one channel where the renderer names a
 * path of its own, and `join(root, '../../..')` escapes the project on every platform — the
 * whole folder is otherwise reachable from a window that is not supposed to touch the disk.
 * Backslashes are refused rather than translated: Windows accepts them as separators, so
 * `..\..` would walk out through a check that only looked at `/`.
 */
const folderPath = z
  .string()
  .refine(value => !isAbsolute(value) && !value.startsWith('/') && !value.includes('\\'))
  .refine(value => value.split('/').every(segment => segment !== '.' && segment !== '..'))

export function parseFolderPath(value: unknown): string {
  return folderPath.parse(value)
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
  // The same shape the explorer's own channel is held to: it is the surface that asks this.
  path: folderPath.optional(),
  location: z.enum(['local', 'cloud']).optional(),
  syncStatus: z.custom<SyncStatus>(isSyncStatus).optional(),
  groupId: z.string().trim().min(1).optional(),
  generated: z.literal(true).optional(),
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

// A derived channel is at most the size of what it was derived from, and 8K RGBA encodes well
// under this. Bounded for the same reason a take is: the renderer is the sandboxed side.
const MAX_PICTURE_BYTES = 256 * 1024 * 1024

/** The eight bytes every PNG opens with. A file that does not is not one, whatever it is called. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)
}

const saveTexture = z.object({
  name: z.string().trim().min(1).max(200),
  map: z.custom<PbrChannel>(isPbrChannel),
  derivedFrom: assetId.optional(),
  // Checked, not merely bounded: an encoder that answered with nothing would otherwise be
  // catalogued as a channel, and the tile would show an empty frame for a file that is not a
  // picture — with no way, from there, to read why.
  png: z
    .instanceof(Uint8Array)
    .refine(bytes => bytes.byteLength <= MAX_PICTURE_BYTES)
    .refine(isPng),
})

export function parseSaveTexture(value: unknown): SaveTextureRequest {
  return saveTexture.parse(value)
}

/**
 * Base64 grows by four bytes for every three, so the same ceiling as a channel's bytes is this
 * much text. Bounded before it is decoded: the decoding is what would allocate.
 */
const MAX_PICTURE_BASE64 = Math.ceil((MAX_PICTURE_BYTES * 4) / 3)

const savePicture = z.object({
  name: z.string().trim().min(1).max(200),
  derivedFrom: assetId.optional(),
  // The same rule the export applies, for the same reason: a `data:image/png;base64,` prefix
  // reaching the file would be written as part of the picture. That the payload really decodes
  // to a PNG is checked once, by the handler, on the bytes it decodes anyway.
  png: z.string().max(MAX_PICTURE_BASE64).pipe(base64Payload),
})

export function parseSavePicture(value: unknown): SavePictureRequest {
  return savePicture.parse(value)
}

/** Whether decoded bytes really are a PNG — the check `saveTexture` makes on its own buffer. */
export function isPngBytes(bytes: Uint8Array): boolean {
  return isPng(bytes)
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

/**
 * The files that go beside the content — one PNG per layer of an image document.
 *
 * `isPartName` is the guard that matters and it lives where the file is written; this only
 * bounds what crosses. Without this field the schema STRIPPED every part in silence, and
 * `storeFolder` then replaced the document folder with a manifest and nothing else: a save
 * threw away the pixels it was called to keep.
 */
const MAX_PART_BYTES = 512 * 1024 * 1024

const documentPart = z.object({
  name: z.string().min(1).max(255),
  data: z.string().max(MAX_PART_BYTES),
})

const documentDraft = z.object({
  title,
  content,
  parts: z.array(documentPart).max(1024).optional(),
  // The asset this document edits. Same reason as `parts`: a field the schema does not name is
  // a field the renderer writes and the disk never sees.
  sourceAssetId: assetId.optional(),
})

/** A title on its way into a dialog. Capped like the one a draft carries, and for the same reason. */
export function parseDocumentTitle(value: unknown): string {
  return title.parse(value)
}

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
  // Absent on every document written before assets could be opened, and on every document that
  // edits none — so an absent field means "not linked" rather than a file to migrate.
  sourceAssetId: z.string().min(1).optional(),
})

/** A document file is user territory, like the manifest: hand-edited, truncated, or older. */
export function parseDocumentEnvelope(value: unknown): DocumentEnvelope {
  return documentEnvelope.parse(value)
}
