import type { PbrChannel } from '@shared/domain/texture'
import type { Command } from '../core/history'
import type { ChannelMap, MaterialSettings, PreviewSettings, TextureState } from './texture-state'

/**
 * Texture edits. Each captures what it needs to revert **as it is applied** rather than as it is
 * built, so a command survives being redone.
 *
 * The `id` is what the history coalesces on: every frame of one slider drag carries the same id
 * and collapses into a single undo entry, while moving to another slider starts a new one.
 */
function replaceSection<K extends keyof TextureState>(
  id: string,
  key: K,
  next: (previous: TextureState[K]) => TextureState[K],
): Command<TextureState> {
  let captured = false
  let before: TextureState[K] | undefined

  return {
    id,
    apply: texture => {
      before = texture[key]
      captured = true
      return { ...texture, [key]: next(texture[key]) }
    },
    revert: texture => (captured ? { ...texture, [key]: before } : texture),
  }
}

/** One entry per setting, so dragging one slider does not swallow the previous one's entry. */
export function setMaterial<K extends keyof MaterialSettings>(
  key: K,
  value: MaterialSettings[K],
): Command<TextureState> {
  return replaceSection(`material:${key}`, 'material', material => ({ ...material, [key]: value }))
}

export function setPreview<K extends keyof PreviewSettings>(
  key: K,
  value: PreviewSettings[K],
): Command<TextureState> {
  return replaceSection(`preview:${key}`, 'preview', preview => ({ ...preview, [key]: value }))
}

/** Puts a map in a channel, or takes it out. Coalesced per channel, never across two. */
export function setChannel(channel: PbrChannel, map: ChannelMap | null): Command<TextureState> {
  return replaceSection(`channel:${channel}`, 'channels', channels => {
    if (!map) {
      const remaining = { ...channels }
      delete remaining[channel]
      return remaining
    }
    return { ...channels, [channel]: map }
  })
}
