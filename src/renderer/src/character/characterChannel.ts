import { isRecord } from '@shared/guards'
import { isVector3 } from '@shared/domain/scene'
import { isRig, type Rig } from '@shared/domain/rig'
import type { Bounds } from '@/engines/scene/rigFit'

/**
 * What the studio and the skeleton window say to each other.
 *
 * A `BroadcastChannel` and not the bridge, for `gameChannel`'s reason: both windows load the same
 * bundle and already share these types. The bridge keeps what only it can do — opening the
 * window, saying it went.
 */
export type CharacterMessage =
  /**
   * What the window is editing, published on every change.
   *
   * 🛑 The studio needs it: every assistant action runs in the studio window, whose own
   * character store is empty — an action naming a character could reach none without this.
   */
  | { kind: 'holds'; assetId: string; rig: Rig | null; bounds: Bounds | null }
  /** The window closed the character, or turned towards another one. */
  | { kind: 'dropped'; assetId: string }
  /** The file was written back. Every scene holding this model rereads it — at ⌘S, never before. */
  | { kind: 'saved'; assetId: string }

const CHANNEL = 'ia-studio.character'

/** Opens the channel. Both ends call this; each posts what the other listens for. */
export function openCharacterChannel(): BroadcastChannel {
  return new BroadcastChannel(CHANNEL)
}

/**
 * Reads a message off the wire, or nothing. A `BroadcastChannel` is reachable by anything on this
 * origin, so what arrives is checked rather than trusted.
 */
export function characterMessageOf(data: unknown): CharacterMessage | null {
  if (!isRecord(data)) return null

  switch (data.kind) {
    case 'holds':
      return named(data) && (data.rig === null || isRig(data.rig))
        ? { kind: 'holds', assetId: data.assetId, rig: data.rig, bounds: boundsOf(data.bounds) }
        : null
    case 'dropped':
      return named(data) ? { kind: 'dropped', assetId: data.assetId } : null
    case 'saved':
      return named(data) ? { kind: 'saved', assetId: data.assetId } : null
    default:
      return null
  }
}

function named(
  data: Record<string, unknown>,
): data is Record<string, unknown> & { assetId: string } {
  return typeof data.assetId === 'string' && data.assetId !== ''
}

/** What the window measured of the mesh, which is what a fit proportions itself off. */
function boundsOf(value: unknown): Bounds | null {
  if (!isRecord(value) || !isVector3(value.min) || !isVector3(value.max)) return null

  return { min: value.min, max: value.max }
}
