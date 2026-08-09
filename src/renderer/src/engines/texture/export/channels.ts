import { PBR_CHANNELS } from '@shared/domain/texture'
import type { ExportChannels } from '@shared/domain/texture-export'
import type { TextureState } from '../texture-state'

/**
 * What the export needs to know about a texture's channels, and nothing else.
 *
 * The width and the height are dropped on purpose: they are what the file said when it was
 * written, and an export reads the decoded picture — a channel replaced outside the studio
 * would otherwise be packed at the size the document remembered.
 *
 * `invertNormalGreen` comes down here from the material, because it is not a render setting at
 * all: it says which convention the normal arrived in, and a target asks for a convention. The
 * two only ever meet on the way out.
 */
export function exportChannelsOf({ channels, material }: TextureState): ExportChannels {
  const exported: ExportChannels = {}

  for (const channel of PBR_CHANNELS) {
    const map = channels[channel]
    if (!map) continue

    exported[channel] = {
      assetId: map.assetId,
      ...(map.inverted ? { inverted: map.inverted } : {}),
      ...(channel === 'normal' && material.invertNormalGreen ? { greenFlipped: true } : {}),
    }
  }

  return exported
}
