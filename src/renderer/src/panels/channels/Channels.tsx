import { mdiTextureBox } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isLocalPicture, PICTURES, type Asset } from '@shared/domain/asset'
import { PBR_CHANNELS } from '@shared/domain/texture'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { setChannel } from '@/engines/texture/commands'
import { placeTextureChannel } from '@/spaces/textures/place-channel'
import { assetsById, useAssets } from '@/stores/assets'
import { activeTextureId, useDocuments } from '@/stores/documents'
import { inspectedChannel, useTextureViews } from '@/stores/texture-views'
import { textureOf, useTextures } from '@/stores/textures'
import { ChannelTile } from './ChannelTile'

/**
 * The eight channels a material is made of, each one a tile.
 *
 * A grid rather than the strip the brief drew: it lives in the right column, where what speaks
 * about the document lives, so the eight wrap instead of running across a band the asset shelf
 * already owns — and a channel and the shelf you drag onto it stay on screen together.
 */
export function Channels() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeTextureId)

  return documentId ? (
    <Grid documentId={documentId} />
  ) : (
    <EmptyState icon={mdiTextureBox} message={t('texture.noDocument')} />
  )
}

function Grid({ documentId }: { documentId: string }) {
  const channels = useTextures(state => textureOf(state, documentId).channels)
  const assets = useAssets(state => state.items)
  const byId = useAssets(assetsById)

  /**
   * `isLocalPicture` and nothing else, the same filter the environment section applies: a cloud
   * row would be offered, chosen, and show nothing at all.
   */
  const options = useMemo(
    () =>
      assets
        .filter(asset => asset.type === 'image' && isLocalPicture(asset))
        .map(asset => ({ id: asset.id, name: asset.name })),
    [assets],
  )

  const run = useTextures(state => state.runCommand)
  const inspected = useTextureViews(state => inspectedChannel(state, documentId))
  const inspect = useTextureViews(state => state.inspect)

  return (
    <div className="grid grid-cols-2 gap-1 p-1">
      {PBR_CHANNELS.map(channel => (
        // Dropped on its own tile, so a picture lands in the channel it was aimed at rather than
        // in the base colour the viewport assumes.
        <AssetDropTarget
          key={channel}
          accepts={PICTURES}
          onDrop={(asset: Asset) => placeTextureChannel(documentId, asset, channel)}
          className="relative"
        >
          <ChannelTile
            channel={channel}
            map={channels[channel] ?? null}
            options={options}
            inspected={inspected === channel}
            onPick={assetId => {
              const asset = byId.get(assetId)
              if (asset) placeTextureChannel(documentId, asset, channel)
            }}
            onClear={() => run(documentId, setChannel(channel, null))}
            // Clicking the one already shown flat goes back to the lit material: one gesture in
            // and out, rather than a second control to find.
            onInspect={() => inspect(documentId, inspected === channel ? null : channel)}
          />
        </AssetDropTarget>
      ))}
    </div>
  )
}
