import { useMemo, useState } from 'react'
import { isLocalPicture, PICTURES, type Asset } from '@shared/domain/asset'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { setChannel } from '@/engines/texture/commands'
import { canDerive, sourceFor } from '@/engines/texture/textureState'
import { placeTextureChannel } from '@/spaces/textures/placeChannel'
import { useAssets } from '@/stores/assets'
import { inspectedChannel, useTextureViews } from '@/stores/textureViews'
import { textureOf, useTextures } from '@/stores/textures'
import { ChannelTile, type DerivationState } from '../ChannelTile'

export function ChannelsGrid({ documentId }: { documentId: string }) {
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

  const [deriving, setDeriving] = useState<PbrChannel | null>(null)

  /**
   * Reached by an `import()` rather than at the top of the file: the panels are in the opening
   * chunk, and the derivation carries three.js and a WebGL renderer behind it. A channel is
   * computed once in a while, by hand — the wait to fetch its chunk is the click itself.
   */
  const derive = async (channel: PbrChannel): Promise<void> => {
    setDeriving(channel)
    try {
      const { deriveTextureChannel } = await import('@/spaces/textures/deriveChannel')
      await deriveTextureChannel(documentId, channel)
    } finally {
      setDeriving(null)
    }
  }

  /**
   * One derivation at a time: each opens a WebGL context of its own, and a browser stops handing
   * them out around sixteen. So the other rows go dead rather than merely unmarked — and they say
   * why, which is the difference between waiting and being broken.
   */
  const derivationState = (channel: PbrChannel): DerivationState => {
    if (deriving === channel) return 'running'
    if (deriving) return 'blocked'
    return canDerive(channels, channel) ? 'ready' : 'missing'
  }
  // Derived where both stores are visible, as the document derives it: a channel emptied while it
  // was the one being looked at left its tile pressed AND disabled, saying two things at once.
  const shown = inspected && channels[inspected] ? inspected : null

  return (
    <div className="grid grid-cols-2 gap-2 p-1">
      {PBR_CHANNELS.map(channel => {
        // `sourceFor` alone decides whether the row exists: it is the domain's own answer, and
        // a test holds it against the table of shaders so the two cannot drift apart.
        const from = sourceFor(channel)

        return (
          // Dropped on its own tile, so a picture lands in the channel it was aimed at rather
          // than in the base colour the viewport assumes.
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
              derivation={
                from && {
                  source: from,
                  state: derivationState(channel),
                  run: () => void derive(channel),
                }
              }
              onPick={assetId => {
                const asset = pictures.find(candidate => candidate.id === assetId)
                if (asset) placeTextureChannel(documentId, asset, channel)
              }}
              onClear={() => run(documentId, setChannel(channel, null))}
              // Clicking the one already shown flat goes back to the lit material: one gesture
              // in and out, rather than a second control to find.
              onInspect={() => inspect(documentId, shown === channel ? null : channel)}
            />
          </AssetDropTarget>
        )
      })}
    </div>
  )
}
