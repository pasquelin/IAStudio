import { rm, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  ASSET_FOLDERS,
  type Asset,
  type AssetGeneration,
  type AssetType,
  type MediaProbe,
} from '@shared/domain/asset'
import { POSTERS_FOLDER } from '@shared/domain/project'
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
  /** The project the twin belongs to — an API key opens onto one, and keys can be swapped. */
  remoteOwnerId?: string
  remoteUpdatedAt?: string
  derivedFrom?: string
  /** What ties the outputs of one generation together — the seven channels of a PBR pack. */
  groupId?: string
  outputIndex?: number
  /** The model, prompt and parameters behind it, read off the API asset rather than the job. */
  generation?: AssetGeneration
  map?: PbrChannel
  mapInverted?: boolean
  /**
   * The library's own still for this asset. Brought down for the kinds no browser can decode —
   * a mesh — so a tile that was a picture in the library stays one once the file is here.
   */
  thumbnailUrl?: string
}

/** An import whose bytes the caller already holds — an edited take, rather than a download. */
type WriteRequest = Omit<ImportRequest, 'url'> & {
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
 * What an asset that came down from the library records about its twin.
 *
 * It is `synced` the moment it lands, and that is not an assumption: the bytes on disk were
 * just downloaded from the very asset being pointed at, so the two sides cannot differ yet.
 * `remoteSyncedAt` is the baseline both later stamps are measured against.
 */
export function twinOf(
  request: Pick<ImportRequest, 'remoteAssetId' | 'remoteOwnerId' | 'remoteUpdatedAt'>,
  at: string,
): Partial<Asset> {
  if (!request.remoteAssetId) return {}

  return {
    remoteAssetId: request.remoteAssetId,
    syncStatus: 'synced',
    remoteSyncedAt: at,
    ...(request.remoteOwnerId ? { remoteOwnerId: request.remoteOwnerId } : {}),
    ...(request.remoteUpdatedAt ? { remoteUpdatedAt: request.remoteUpdatedAt } : {}),
  }
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
  /**
   * The library's still, brought down beside the bytes — for a mesh, and for a mesh alone.
   *
   * A picture IS its own poster. A rush and a take have one waiting for them at ingest, and a
   * still recorded here would be painted UNDER the waveform of every audio clip on the timeline
   * (`posterUrl` is what a clip reads) — a picture of the take before any edit, at that. Only
   * `.glb` has nothing any surface can decode, which is the whole reason this exists.
   *
   * Best effort, and that is the whole design: the thumbnail is a convenience, the model is the
   * asset. A CDN that answers 404 must leave the import that carries it untouched.
   */
  const savePoster = async (request: WriteRequest): Promise<string | undefined> => {
    if (!request.thumbnailUrl || request.type !== 'mesh') return undefined

    try {
      const poster = await download(request.thumbnailUrl)
      const relative = `${POSTERS_FOLDER}/${request.id}${extensionOf(request.thumbnailUrl, 'image')}`
      await writeFile(join(projectPath(), relative), poster)
      return relative
    } catch {
      return undefined
    }
  }

  const write = async (request: WriteRequest, bytes: Uint8Array): Promise<Asset> => {
    const relativePath = relativePathFor(request.id, request.extension, request.type)

    // Together: the still is a second download over the network, and waiting for it after the
    // bytes are already on disk would add its latency to every import that carries one.
    const [, posterPath] = await Promise.all([
      writeFile(join(projectPath(), relativePath), bytes),
      savePoster(request),
    ])

    const at = now()
    // What the row already held survives being written again. Pulling a twin a second time
    // lands on the same id on purpose, and rebuilding the asset from the request alone dropped
    // the tags the user had put on it and moved its creation date to now — which also sent it
    // back to the top of a shelf sorted newest first, for a file that had not changed.
    const existing = await catalog().find(request.id)

    // The still's name follows the extension the CDN's URL carried, and a second pull of the
    // same twin can carry another one. The file the row stops pointing at is ours and nothing
    // would ever come back for it — the same reason `replaceBytes` drops the file it replaces.
    if (posterPath && existing?.posterPath && existing.posterPath !== posterPath) {
      await rm(join(projectPath(), existing.posterPath), { force: true })
    }

    const asset: Asset = {
      ...existing,
      id: request.id,
      name: request.name,
      type: request.type,
      location: 'local',
      path: relativePath,
      bytes: bytes.byteLength,
      tags: existing?.tags ?? [],
      createdAt: existing?.createdAt ?? at,
      localChangedAt: at,
      ...(request.probe ? { probe: request.probe } : {}),
      // Absent rather than cleared: a still that failed to come down this time leaves the one
      // an earlier pull already put on disk, which is still a true picture of the same asset.
      ...(posterPath ? { posterPath } : {}),
      ...(request.jobId ? { jobId: request.jobId } : {}),
      ...(request.derivedFrom ? { derivedFrom: request.derivedFrom } : {}),
      ...(request.groupId ? { groupId: request.groupId } : {}),
      ...(request.outputIndex !== undefined ? { outputIndex: request.outputIndex } : {}),
      ...(request.generation ? { generation: request.generation } : {}),
      // Nested: the flag says how to read a channel, so it means nothing without one — and the
      // catalogue only reads it back inside a valid channel anyway.
      ...(request.map
        ? { map: request.map, ...(request.mapInverted ? { mapInverted: true } : {}) }
        : {}),
      ...twinOf(request, at),
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
      if (!existing) throw new Error(`asset ${assetId} is not in the catalogue`)

      // Written INSIDE the project, always — including for a row that had no file there.
      //
      // A linked asset keeps its bytes where the user left them and `path` empty on purpose
      // (`linkedAsset` says so). Editing one used to be refused outright; it now lands in the
      // project and the row gains its `path`, so the shelf, the scene and every other reader
      // show the edit. The file that was linked is NOT touched: the studio writing into a
      // folder the user only pointed at is a different act from editing an asset, and the one
      // guard that keeps every other write inside the project — `assetFilePath` — exists
      // precisely because a catalogue row is user-editable territory.
      const relativePath = relativePathFor(assetId, extension, existing.type)
      await writeFile(join(projectPath(), relativePath), bytes)

      // The extension follows the bytes: an edited take goes back as a `.wav`, and leaving it
      // under the `.mp3` it was imported as would hand every reader a file that lies. Only a
      // file the PROJECT held is removed — a linked one is not ours to delete.
      if (existing.path && relativePath !== existing.path) {
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
        localChangedAt: now(),
        // The file just changed under a twin that has not: saying so is what later lets a push
        // be offered, and what stops an edited take from passing for identical to the library.
        ...(existing.remoteAssetId ? { syncStatus: 'local-ahead' } : {}),
        ...(probe ? { probe } : {}),
      }
      delete rewritten.peaksPath

      return await catalog().add(rewritten)
    },
  }
}
