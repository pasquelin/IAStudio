import type { MaterialSettings, PbrChannel } from '@shared/domain/material'
import type { Command } from '../core/history'
import type { ChannelMap, PreviewSettings, MaterialState } from './materialState'

/**
 * Texture edits. Each captures what it needs to revert **as it is applied** rather than as it is
 * built, so a command survives being redone.
 *
 * The `id` is what the history coalesces on: every frame of one slider drag carries the same id
 * and collapses into a single undo entry, while moving to another slider starts a new one.
 */
function replaceSection<K extends keyof MaterialState>(
  id: string,
  key: K,
  next: (previous: MaterialState[K]) => MaterialState[K],
): Command<MaterialState> {
  let captured = false
  let before: MaterialState[K] | undefined

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
export function setMaterialSetting<K extends keyof MaterialSettings>(
  key: K,
  value: MaterialSettings[K],
): Command<MaterialState> {
  return replaceSection(`material:${key}`, 'material', material => ({ ...material, [key]: value }))
}

/**
 * A whole material at once — what applying a saved style does.
 *
 * Keyed on the style rather than on the word "style": two styles applied in a row must leave two
 * undo entries, and one shared id would coalesce them into one that gives back neither.
 *
 * The channels are not touched, which is the whole reason a style applies to any texture: it
 * says how to read the maps in front of it, never which maps to read.
 */
export function applyStyle(styleId: string, values: MaterialSettings): Command<MaterialState> {
  return replaceSection(`material:style:${styleId}`, 'material', () => values)
}

export function setPreview<K extends keyof PreviewSettings>(
  key: K,
  value: PreviewSettings[K],
): Command<MaterialState> {
  return replaceSection(`preview:${key}`, 'preview', preview => ({ ...preview, [key]: value }))
}

/** Puts a map in a channel, or takes it out. Coalesced per channel, never across two. */
export function setChannel(channel: PbrChannel, map: ChannelMap | null): Command<MaterialState> {
  return replaceSection(`channel:${channel}`, 'channels', channels => {
    if (!map) {
      const remaining = { ...channels }
      delete remaining[channel]
      return remaining
    }
    return { ...channels, [channel]: map }
  })
}
