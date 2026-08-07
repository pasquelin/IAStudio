import type { Asset } from '@shared/domain/asset'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseAssetId } from '@main/project/validation'
import { assetTypeOf, linkedAsset } from './link'
import type { MediaService } from './service'

export type MediaHandlerDeps = {
  media: MediaService
  /** Writes the row and hands it back — the catalogue belongs to the open project. */
  addAsset: (asset: Asset) => Asset
  /** Injected rather than imported: `dialog` needs a live app, which no test has. */
  pickMedia: () => Promise<string[]>
  newId: () => string
  now: () => string
}

export function registerMediaHandlers({
  media,
  addAsset,
  pickMedia,
  newId,
  now,
}: MediaHandlerDeps): void {
  handle(CHANNELS.mediaIngest, async () => {
    const assets: Asset[] = []

    for (const source of await pickMedia()) {
      const type = assetTypeOf(source)
      if (!type) continue

      const asset = addAsset(linkedAsset(source, { id: newId(), type, now: now() }))
      assets.push(asset)
      // Not awaited: the row exists, so the browser shows the file at once, while probing a
      // twenty-minute rush goes on reporting through `evt:media-progress`.
      void media.ingest(asset.id, source, type)
    }

    return assets
  })

  handle(CHANNELS.mediaCancel, (_event, assetId) => media.cancel(parseAssetId(assetId)))

  handle(CHANNELS.mediaAvailable, () => ({ ffmpeg: media.available() }))
}
