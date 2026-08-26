import i18next from 'i18next'
import { assetUrl } from '@shared/domain/asset'
import type { PbrChannel } from '@shared/domain/material'
import { loadTexture } from '@/engines/scene/textureCache'
import { createDerivePort, type DerivePort } from '@/engines/material/derive/derivePort'
import { setChannel } from '@/engines/material/commands'
import { sourceFor, type ChannelSet } from '@/engines/material/materialState'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { materialOf, useMaterials } from '@/stores/materials'

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
export async function deriveMaterialChannel(
  documentId: string,
  channel: PbrChannel,
  derive: DerivePort = gpuDerive,
): Promise<boolean> {
  const from = sourceFor(channel)
  const bridge = getBridge()
  if (!from || !bridge) return false

  const source = channels(documentId)[from]
  if (!source) {
    reportFailure('material.channel', channel, new Error(`${from} is empty`))
    return false
  }

  /**
   * What must not have moved while this ran, checked after EVERY await rather than once.
   *
   * Both ends matter, and each was a way of losing work. The **source**: pixels computed from a
   * height map that has since been replaced describe nothing that is still open. The
   * **destination**: only the menu row goes dead during a derivation — the tile still takes a
   * drop, and a picture the user put there by hand would be silently overwritten by a result
   * badged `derived`. The most recent gesture is the one that has to survive.
   *
   * And the two longest waits come AFTER the first check: writing the file, then relisting the
   * catalogue. A check that closed before them would leave exactly the state it exists to stop.
   */
  const before = { source: source.assetId, target: channels(documentId)[channel]?.assetId }

  /** Which end moved, so the journal names it rather than saying something changed. */
  const moved = (): PbrChannel | null => {
    const now = channels(documentId)
    if (now[from]?.assetId !== before.source) return from
    return now[channel]?.assetId !== before.target ? channel : null
  }

  const abandon = (which: PbrChannel): false => {
    reportFailure('material.channel', channel, new Error(`${which} changed while deriving`))
    return false
  }

  try {
    const picture = await derive({ channel, sourceUrl: assetUrl(source.assetId) })

    // Said rather than swallowed — the menu row would otherwise look inert. Checked here so a
    // file is not written for a result already known to be stale.
    const stale = moved()
    if (stale) return abandon(stale)

    const asset = await bridge.assets.saveTexture({
      name: derivedName(from, channel, source.assetId),
      map: channel,
      derivedFrom: source.assetId,
      png: picture.png,
    })

    // Before the channel points at it: the tile reads the shelf for the picture it shows, and a
    // channel filled with an id the store has never heard of shows an empty frame.
    await useAssets.getState().refresh()

    const late = moved()
    if (late) return abandon(late)

    useMaterials.getState().runCommand(
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
    reportFailure('material.channel', channel, error)
    return false
  }
}

/** Read at call time, never captured: every check has to see the store as it is right now. */
function channels(documentId: string): ChannelSet {
  return materialOf(useMaterials.getState(), documentId).channels
}

/**
 * What the derived picture is called in the shelf. The source's own name is what makes it
 * findable among the eight a pack holds — an opaque id is not.
 */
function derivedName(from: PbrChannel, channel: PbrChannel, sourceAssetId: string): string {
  const source = assetsById(useAssets.getState()).get(sourceAssetId)
  return i18next.t('material.derivedName', {
    name: source?.name ?? i18next.t(`material.channel.${from}`),
    channel: i18next.t(`material.channel.${channel}`),
  })
}
