import i18next from 'i18next'
import { assetUrl } from '@shared/domain/asset'
import type { PbrChannel } from '@shared/domain/texture'
import { loadTexture } from '@/engines/scene/texture-cache'
import { createDerivePort, type DerivePort } from '@/engines/texture/derive/derive-port'
import { setChannel } from '@/engines/texture/commands'
import { sourceFor } from '@/engines/texture/texture-state'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { textureOf, useTextures } from '@/stores/textures'

/** The GPU port, built once. It holds nothing: a context is made and released per derivation. */
const gpuDerive = createDerivePort({ loadTexture })

/**
 * Computes one channel of a texture from another, and puts the result in the project.
 *
 * A new asset every time, never an overwrite: a derivation is cheap to run again, and the file
 * a user could have painted over is not the studio's to replace. The channel it lands in is
 * badged `derived`, which is what tells it from the frozen output of a model.
 *
 * Answers whether it landed. Failures are reported rather than thrown: the caller is a menu
 * row, and a rejected promise there is a row that does nothing and says nothing.
 */
export async function deriveTextureChannel(
  documentId: string,
  channel: PbrChannel,
  derive: DerivePort = gpuDerive,
): Promise<boolean> {
  const from = sourceFor(channel)
  const bridge = getBridge()
  if (!from || !bridge) return false

  const source = textureOf(useTextures.getState(), documentId).channels[from]
  if (!source) {
    reportFailure('texture.channel', channel, new Error(`${from} is empty`))
    return false
  }

  try {
    const picture = await derive({ channel, sourceUrl: assetUrl(source.assetId) })

    // Read again, after the await: a derivation runs for as long as the picture takes to decode,
    // and pixels computed from a source that has since been replaced describe nothing that is
    // still open. Said rather than swallowed — the menu row would otherwise look inert.
    const current = textureOf(useTextures.getState(), documentId).channels[from]
    if (current?.assetId !== source.assetId) {
      reportFailure('texture.channel', channel, new Error(`${from} changed while deriving`))
      return false
    }

    const asset = await bridge.assets.saveTexture({
      name: derivedName(from, channel, source.assetId),
      map: channel,
      derivedFrom: source.assetId,
      png: picture.png,
    })

    // Before the channel points at it: the tile reads the shelf for the picture it shows, and a
    // channel filled with an id the store has never heard of shows an empty frame.
    await useAssets.getState().refresh()

    useTextures.getState().runCommand(
      documentId,
      setChannel(channel, {
        assetId: asset.id,
        origin: 'derived',
        width: picture.width,
        height: picture.height,
      }),
    )
    return true
  } catch (error) {
    reportFailure('texture.channel', channel, error)
    return false
  }
}

/**
 * What the derived picture is called in the shelf. The source's own name is what makes it
 * findable among the eight a pack holds — an opaque id is not.
 */
function derivedName(from: PbrChannel, channel: PbrChannel, sourceAssetId: string): string {
  const source = assetsById(useAssets.getState()).get(sourceAssetId)
  return i18next.t('texture.derivedName', {
    name: source?.name ?? i18next.t(`texture.channel.${from}`),
    channel: i18next.t(`texture.channel.${channel}`),
  })
}
