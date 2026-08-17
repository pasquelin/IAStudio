import { withoutSourcePath, type Asset } from '@shared/domain/asset'
import type { MediaCapabilities } from '@shared/domain/media'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { parseAssetId, parseFolderPath } from '@main/project/validation'
import { assetTypeOf } from './link'
import type { MediaService } from './service'

export type MediaHandlerDeps = {
  media: MediaService
  /** Writes a catalogue row for a file left where it lies, and hands it back. */
  link: (source: string, type: Asset['type']) => Promise<Asset>
  /** The same, for a file the project already holds — see `adoptFile`. */
  adopt: (relative: string) => Promise<Asset | null>
  /** Injected rather than imported: `dialog` needs a live app, which no test has. */
  pickMedia: () => Promise<string[]>
  capabilities: () => Promise<MediaCapabilities>
}

export function registerMediaHandlers({
  media,
  link,
  adopt,
  pickMedia,
  capabilities,
}: MediaHandlerDeps): void {
  handle(CHANNELS.mediaAdopt, async (_event, relative) => {
    // A row the window never needs the absolute path of, exactly as the ingest answers.
    const asset = await adopt(parseFolderPath(relative))
    return asset && withoutSourcePath(asset)
  })

  handle(CHANNELS.mediaIngest, async () => {
    const assets: Asset[] = []

    for (const source of await pickMedia()) {
      const type = assetTypeOf(source)
      if (!type) continue

      const asset = await link(source, type)
      assets.push(withoutSourcePath(asset))
      // Not awaited: the row exists, so the browser shows the file at once, while probing a
      // twenty-minute rush goes on reporting through `evt:media-progress`.
      void media.ingest(asset.id, source, type)
    }

    return assets
  })

  handle(CHANNELS.mediaCancel, (_event, assetId) => media.cancel(parseAssetId(assetId)))

  handle(CHANNELS.mediaAvailable, () => capabilities())
}
