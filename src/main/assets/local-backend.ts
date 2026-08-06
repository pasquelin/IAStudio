import { writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import type { Asset, AssetType } from '@shared/domain/asset'
import type { Catalog } from '@main/project/catalog'

/** Where each kind of asset lands inside a project — mirrors `PROJECT_FOLDERS`. */
const FOLDER: Record<AssetType, string> = {
  image: 'assets/img',
  video: 'assets/vid',
  audio: 'assets/aud',
  mesh: 'assets/3d',
  texture: 'assets/tex',
  skybox: 'assets/sky',
}

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
  catalog: () => Catalog
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
}

export type LocalBackend = {
  importFromUrl: (request: ImportRequest) => Promise<Asset>
}

/**
 * A URL carries a name, and a name carries whatever the API put in it. Only the extension is
 * kept, and only if it looks like one — the file name itself comes from our own asset id.
 */
export function extensionOf(url: string, type: AssetType): string {
  try {
    const extension = extname(new URL(url).pathname)
    return /^\.[a-z0-9]{1,8}$/i.test(extension) ? extension.toLowerCase() : FALLBACK_EXTENSION[type]
  } catch {
    return FALLBACK_EXTENSION[type]
  }
}

export function relativePathFor(id: string, url: string, type: AssetType): string {
  return `${FOLDER[type]}/${id}${extensionOf(url, type)}`
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
  return {
    importFromUrl: async request => {
      const relativePath = relativePathFor(request.id, request.url, request.type)
      const bytes = await download(request.url)
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

      if (request.jobId) asset.jobId = request.jobId
      if (request.remoteAssetId) asset.remoteAssetId = request.remoteAssetId
      if (request.derivedFrom) asset.derivedFrom = request.derivedFrom

      return catalog().add(asset)
    },
  }
}
