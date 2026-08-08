import type { Asset } from '@shared/domain/asset'
import { UPLOAD_KIND_BY_TYPE, uploadMimeTypeOf, type UploadKind } from '@shared/domain/asset-mime'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import type { AsyncCatalog } from '@main/project/catalog-client'
import type { DownloadFormat, RemoteAssetCatalog } from '@main/scenario/asset-catalog'
import type { LocalBackend } from './local-backend'

/**
 * Sending a file the API cannot take in one request. Everything but a small picture goes this
 * way — a rush is gigabytes, and the base64 body tops out at six megabytes.
 */
export type MultipartUpload = (params: {
  file: string
  fileName: string
  contentType: string
  kind: UploadKind
}) => Promise<{ assetId: string; updatedAt?: string; ownerId?: string }>

/** A picture small enough to travel as base64 — the path `uploader.ts` already opened. */
export type SmallUpload = (name: string, base64: string) => Promise<string>

export type CloudBackendDeps = {
  remote: () => RemoteAssetCatalog
  multipart: MultipartUpload
  small: SmallUpload
  local: LocalBackend
  catalog: () => AsyncCatalog
  /** Absolute path of a file inside the project, from the path the catalogue stores. */
  resolve: (relativePath: string) => string
  readFile: (absolutePath: string) => Promise<Uint8Array>
  newId: () => string
  now: () => string
  /** Past this, base64 is refused and the multipart flow takes over. */
  smallUploadLimit: number
}

export type CloudBackend = {
  /** Brings a library asset into the project, bytes and all. */
  pull: (asset: CloudAsset) => Promise<Asset>
  /** Sends a local asset up, and records the twin it became. */
  push: (assetId: string) => Promise<Asset>
}

/**
 * The format to ask the CDN for on the way down.
 *
 * Meshes are converted to glb because that is the only thing the scene loads, and the CDN does
 * it for free — asking for the original would land an fbx nobody can open. Everything else comes
 * down as it is: re-encoding a picture would lose exactly what a studio is judging.
 */
function downloadFormatOf(asset: CloudAsset): DownloadFormat | undefined {
  return asset.type === 'mesh' ? 'glb' : undefined
}

/** Base64 carries three bytes in four characters. Measured before sending, never after. */
function base64Of(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64')
}

export function createCloudBackend({
  remote,
  multipart,
  small,
  local,
  catalog,
  resolve,
  readFile,
  newId,
  now,
  smallUploadLimit,
}: CloudBackendDeps): CloudBackend {
  return {
    pull: async cloudAsset => {
      // Asked for again rather than reused: the URL an asset arrives with is signed and expires,
      // and a listing held for a minute already carries one that may not last the download.
      const url = await remote().downloadUrl(cloudAsset.id, downloadFormatOf(cloudAsset))

      // A twin already in the project is refreshed in place, not doubled: pulling twice must not
      // leave two rows pointing at one library asset, which is what `findByRemoteId` guards.
      const existing = await catalog().findByRemoteId(cloudAsset.id)

      return await local.importFromUrl({
        id: existing?.id ?? newId(),
        url,
        name: cloudAsset.name,
        type: cloudAsset.type,
        remoteAssetId: cloudAsset.id,
        ...(cloudAsset.ownerId ? { remoteOwnerId: cloudAsset.ownerId } : {}),
        ...(cloudAsset.updatedAt ? { remoteUpdatedAt: cloudAsset.updatedAt } : {}),
        ...(cloudAsset.generation ? { generation: cloudAsset.generation } : {}),
      })
    },

    push: async assetId => {
      const asset = await catalog().find(assetId)
      if (!asset) throw new Error(`asset ${assetId} is not in the catalogue`)

      // What is pushed is the file the project holds. An asset that lives only in the library
      // has nothing to send, and a linked rush is sent from where it lies.
      const relativePath = asset.path ?? asset.sourcePath
      if (!relativePath) throw new Error(`asset ${assetId} has no file to send`)

      const absolutePath = asset.path ? resolve(asset.path) : relativePath
      const fileName = `${asset.name.replace(/[/\\]/g, '-')}${extensionOf(absolutePath)}`
      const contentType = uploadMimeTypeOf(absolutePath)
      // Refused here rather than after the transfer: the API validates the content type once the
      // whole file has arrived, which for a rush is minutes of upload spent to be told no.
      if (!contentType) throw new Error(`the API does not accept ${fileName}`)

      const bytes = await readFile(absolutePath)
      const twin =
        asset.type !== 'video' && asset.type !== 'audio' && bytes.byteLength <= smallUploadLimit
          ? { assetId: await small(fileName, base64Of(bytes)) }
          : await multipart({
              file: absolutePath,
              fileName,
              contentType,
              kind: UPLOAD_KIND_BY_TYPE[asset.type],
            })

      const at = now()
      const pushed: Asset = {
        ...asset,
        remoteAssetId: twin.assetId,
        syncStatus: 'synced',
        remoteSyncedAt: at,
        ...(twin.ownerId ? { remoteOwnerId: twin.ownerId } : {}),
        ...(twin.updatedAt ? { remoteUpdatedAt: twin.updatedAt } : {}),
      }
      // The error of a previous attempt goes with the success, or the badge keeps explaining a
      // failure that no longer happened.
      delete pushed.syncError

      return await catalog().add(pushed)
    },
  }
}

function extensionOf(path: string): string {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot)
}
