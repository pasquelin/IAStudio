import { mdiTextureBox } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { isLocalPicture, PICTURES, type Asset } from '@shared/domain/asset'
import { PBR_CHANNELS } from '@shared/domain/texture'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { setChannel } from '@/engines/texture/commands'
import { placeTextureChannel } from '@/spaces/textures/place-channel'
import { useAssets } from '@/stores/assets'
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

  /**
   * The same question the tile answers on a drop, so it gets the same answer: `PICTURES` for the
   * type — a generated sky or texture is a picture a channel can hold — and `isLocalPicture` for
   * the file, because a cloud row would be offered, chosen, and show nothing at all.
   *
   * Filtered on both, and not on `image` alone: dropping a local skybox onto Roughness worked
   * while the menu never listed it, so the tile showed a picture with no row ticked.
   */
  const pictures = useMemo(
    () => assets.filter(asset => PICTURES.includes(asset.type) && isLocalPicture(asset)),
    [assets],
  )
  const options = useMemo(
    () => pictures.map(asset => ({ id: asset.id, name: asset.name })),
    [pictures],
  )

  const run = useTextures(state => state.runCommand)
  const inspected = useTextureViews(state => inspectedChannel(state, documentId))
  const inspect = useTextureViews(state => state.inspect)
  // Derived where both stores are visible, as the document derives it: a channel emptied while it
  // was the one being looked at left its tile pressed AND disabled, saying two things at once.
  const shown = inspected && channels[inspected] ? inspected : null

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
            inspected={shown === channel}
            onPick={assetId => {
              const asset = pictures.find(candidate => candidate.id === assetId)
              if (asset) placeTextureChannel(documentId, asset, channel)
            }}
            onClear={() => run(documentId, setChannel(channel, null))}
            // Clicking the one already shown flat goes back to the lit material: one gesture in
            // and out, rather than a second control to find.
            onInspect={() => inspect(documentId, shown === channel ? null : channel)}
          />
        </AssetDropTarget>
      ))}
    </div>
  )
}
