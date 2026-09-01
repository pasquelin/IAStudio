import { isRecord } from '@shared/guards'
import type { MotionRef } from '@shared/domain/character'

/**
 * What the studio and the skeleton window say to each other.
 *
 * A `BroadcastChannel` and not the bridge, for `gameChannel`'s reason: both windows load the same
 * bundle and already share these types. The bridge keeps what only it can do — opening the
 * window, saying it went.
 */
export type CharacterMessage =
  /**
   * The window asking who it is editing, which it must: a channel replays nothing, and the
   * window opens after the studio asked for it.
   */
  | { kind: 'ask'; assetId: string }
  /** The studio answering: what the catalogue calls it, and what plays beside it. */
  | { kind: 'subject'; assetId: string; name: string; motions: readonly MotionRef[] }
  /** The file was written back. Every scene holding this model rereads it — at ⌘S, never before. */
  | { kind: 'saved'; assetId: string }
  /** The studio is going away: nothing left to answer this window. */
  | { kind: 'gone' }

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
    case 'ask':
      return named(data) ? { kind: 'ask', assetId: data.assetId } : null
    case 'subject':
      return named(data) && typeof data.name === 'string' && Array.isArray(data.motions)
        ? {
            kind: 'subject',
            assetId: data.assetId,
            name: data.name,
            motions: motionsOf(data.motions),
          }
        : null
    case 'saved':
      return named(data) ? { kind: 'saved', assetId: data.assetId } : null
    case 'gone':
      return { kind: 'gone' }
    default:
      return null
  }
}

function named(
  data: Record<string, unknown>,
): data is Record<string, unknown> & { assetId: string } {
  return typeof data.assetId === 'string' && data.assetId !== ''
}

function motionsOf(values: readonly unknown[]): MotionRef[] {
  return values.flatMap(value =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.assetId === 'string'
      ? [{ id: value.id, name: value.name, assetId: value.assetId }]
      : [],
  )
}
