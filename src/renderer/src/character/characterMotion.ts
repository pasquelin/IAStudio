import type { AnimationTimeline } from '@shared/domain/animation'
import { getBridge } from '@/services/bridge'
import { linkCharacterMotion } from '@/engines/character/characterCommands'
import { useCharacters } from '@/stores/character'
import { newId } from '@/helpers/ids'

/** What the band has to hold before there is a motion to file: one key on one channel. */
export function hasMotion(timeline: AnimationTimeline): boolean {
  return timeline.tracks.some(track => track.keys.length > 0)
}

/**
 * Files what the band plays as a motion of the project, and teaches it to this character.
 *
 * A FILE and never something the `.glb` swallows: the same motion plays on every character whose
 * bones carry the same names, which is the whole reason motions are files. The bytes are the
 * workshop scene exported with its baked clip — the studio's own exporter, so a reader knowing
 * nothing of this studio still sees the movement.
 */
export async function saveCharacterMotion(
  assetId: string,
  name: string,
  glb: Uint8Array,
): Promise<boolean> {
  const bridge = getBridge()
  if (!bridge) return false

  const asset = await bridge.assets.saveAnimation({ name, derivedFrom: assetId, glb })
  useCharacters
    .getState()
    .runCommand(assetId, linkCharacterMotion({ id: newId(), name: asset.name, assetId: asset.id }))

  return true
}
