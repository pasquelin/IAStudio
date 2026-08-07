import { rm, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { ASSET_FOLDERS, type Asset, type AssetType, type MediaProbe } from '@shared/domain/asset'
import type { PbrChannel } from '@shared/domain/texture'
import type { AsyncCatalog } from '@main/project/catalog-client'

const FALLBACK_EXTENSION: Record<AssetType, string> = {
  image: '.png',
  video: '.mp4',
  audio: '.mp3',
  mesh: '.glb',
  texture: '.png',
  skybox: '.png',
}

export type Download = (url: string) => Promise<Uint8Array>

export type LocalBackendDeps = {
  download: Download
  projectPath: () => string
  catalog: () => AsyncCatalog
  now: () => string
}

export type ImportRequest = {
  id: string
  url: string
  name: string
  type: AssetType
  jobId?: string
  remoteAssetId?: string
  derivedFrom?: string
  map?: PbrChannel
  mapInverted?: boolean
}

/** An import whose bytes the caller already holds — an edited take, rather than a download. */
export type WriteRequest = Omit<ImportRequest, 'url'> & {
  extension: string
  /** What the bytes say about themselves, when the caller could read it. */
  probe?: MediaProbe
}

export type LocalBackend = {
  importFromUrl: (request: ImportRequest) => Promise<Asset>
  importFromBytes: (request: WriteRequest, bytes: Uint8Array) => Promise<Asset>
  /**
   * Overwrites an asset's file, keeping its id, its name and its place in the catalogue. What
   * "apply" means in the audio editor: the same asset, edited. The extension follows the bytes,
   * so a take re-encoded on the way out is not left claiming to be what it no longer is.
   */
  replaceBytes: (
    assetId: string,
    bytes: Uint8Array,
    extension: string,
    probe?: MediaProbe,
  ) => Promise<Asset>
}

/**
 * Anything that is not a plain extension is refused, and the kind's own is used instead.
 *
 * The refusal is the point, and it lives here rather than at each caller: the string comes
 * from an API response or from the renderer, and `../../.ssh/id_rsa` appended to an asset id
 * would write outside the project entirely.
 */
function safeExtension(extension: string, type: AssetType): string {
  return /^\.[a-z0-9]{1,8}$/i.test(extension) ? extension.toLowerCase() : FALLBACK_EXTENSION[type]
}

/**
 * A URL carries a name, and a name carries whatever the API put in it. Only the extension is
 * kept, and only if it looks like one — the file name itself comes from our own asset id.
 */
export function extensionOf(url: string, type: AssetType): string {
  try {
    return safeExtension(extname(new URL(url).pathname), type)
  } catch {
    return FALLBACK_EXTENSION[type]
  }
}

export function relativePathFor(id: string, extension: string, type: AssetType): string {
  return `${ASSET_FOLDERS[type]}/${id}${safeExtension(extension, type)}`
}

/**
 * Brings a generated asset down to disk and indexes it. The disk is the truth: scrubbing a
 * video and loading a mesh must never depend on the network — see spec § 5.
 */
export function createLocalBackend({
  download,
  projectPath,
  catalog,
  now,
}: LocalBackendDeps): LocalBackend {
  const write = async (request: WriteRequest, bytes: Uint8Array): Promise<Asset> => {
    const relativePath = relativePathFor(request.id, request.extension, request.type)
    await writeFile(join(projectPath(), relativePath), bytes)

    const asset: Asset = {
      id: request.id,
      name: request.name,
      type: request.type,
      location: 'local',
      path: relativePath,
      bytes: bytes.byteLength,
      tags: [],
      createdAt: now(),
    }

    if (request.probe) asset.probe = request.probe
    if (request.jobId) asset.jobId = request.jobId
    if (request.remoteAssetId) asset.remoteAssetId = request.remoteAssetId
    if (request.derivedFrom) asset.derivedFrom = request.derivedFrom
    // Nested: the flag says how to read a channel, so it means nothing without one — and the
    // catalogue only reads it back inside a valid channel anyway.
    if (request.map) {
      asset.map = request.map
      if (request.mapInverted) asset.mapInverted = true
    }

    return await catalog().add(asset)
  }

  return {
    importFromUrl: async request =>
      write(
        { ...request, extension: extensionOf(request.url, request.type) },
        await download(request.url),
      ),

    importFromBytes: (request, bytes) => write(request, bytes),

    replaceBytes: async (assetId, bytes, extension, probe) => {
      const existing = await catalog().find(assetId)
      if (!existing?.path) throw new Error(`asset ${assetId} has no file to replace`)

      const relativePath = relativePathFor(assetId, extension, existing.type)
      await writeFile(join(projectPath(), relativePath), bytes)

      // The extension follows the bytes: an edited take goes back as a `.wav`, and leaving it
      // under the `.mp3` it was imported as would hand every reader a file that lies.
      if (relativePath !== existing.path) {
        await rm(join(projectPath(), existing.path), { force: true })
      }

      // Through `add`, which upserts: the row keeps its id, its tags and its job, and only what
      // the new bytes changed is rewritten.
      //
      // `peaksPath` goes, always: the waveform on disk describes the take before the edit, and
      // a stale one is worse than none — the strip would draw a shape the ear no longer hears.
      // A fresh one comes back when the take is ingested again.
      const rewritten: Asset = {
        ...existing,
        path: relativePath,
        bytes: bytes.byteLength,
        ...(probe ? { probe } : {}),
      }
      delete rewritten.peaksPath

      return await catalog().add(rewritten)
    },
  }
}
