import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { LANGUAGES, TRANSLATIONS, type Language } from '@shared/i18n'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import {
  ADJUSTMENT_KINDS,
  BLEND_MODES,
  LAYER_KINDS,
  type LayerKind,
} from '@/engines/canvas/canvas-state'
import { TRACK_KINDS, type TrackKind } from '@/engines/timeline/timeline-state'
import { TRACK_FLAGS } from '@/panels/timeline/track-flags'

function resolve(code: Language, key: string): unknown {
  // Widened, not cast: the bundle's inferred type has no index signature, and every key here is
  // composed from a registry rather than written down beside it.
  const bundle: unknown = TRANSLATIONS[code]
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

/**
 * The keys the interface builds at runtime, from the lists the renderer owns — the ones in
 * `shared/` are covered beside the bundles themselves.
 *
 * They are what a bundle loses quietly. `layerKind_text` was missing for as long as the text
 * tool has existed: drop a caption on a picture, select the layer, and the inspector read
 * `inspector.layerKind_text` where a word belongs.
 */
const COMPOSED_KEYS: readonly string[] = [
  ...ADJUSTMENT_KINDS.map(kind => `adjustment.${kind}`),
  ...BLEND_MODES.map(mode => `blend.${mode}`),
  ...LAYER_KINDS.map(kind => `inspector.layerKind_${kind}`),
  ...TRACK_KINDS.map(kind => `inspector.kind_${kind}`),
  ...TRACK_FLAGS.map(flag => `inspector.${flag.key}`),
  ...PBR_CHANNELS.map(channel => `texture.channel.${channel}`),
  ...WORKSPACE_IDS.map(workspace => `home.tools.${workspace}`),
]

describe('the keys the renderer composes', () => {
  it.each(LANGUAGES.map(language => language.code))('are all named in %s', code => {
    for (const key of COMPOSED_KEYS) {
      const text = resolve(code, key)
      expect(typeof text === 'string' && text.trim() !== '', `${key} is missing`).toBe(true)
    }
  })
})

/**
 * A list that stands for a union has to cover it, or the walk above skips what it never reaches.
 * `LAYER_KINDS` is the one that matters here: it was written to close this very gap.
 */
describe('the lists behind those keys', () => {
  it('holds every kind a layer can be', () => {
    const all: Record<LayerKind, true> = {
      pixel: true,
      group: true,
      adjustment: true,
      text: true,
    }

    expect([...LAYER_KINDS].sort()).toEqual(Object.keys(all).sort())
  })

  it('holds every kind a track can be', () => {
    const all: Record<TrackKind, true> = { video: true, audio: true }

    expect([...TRACK_KINDS].sort()).toEqual(Object.keys(all).sort())
  })

  it('holds every channel a material carries', () => {
    const all: Record<PbrChannel, true> = {
      baseColor: true,
      normal: true,
      roughness: true,
      metalness: true,
      ao: true,
      height: true,
      emissive: true,
      edge: true,
    }

    expect([...PBR_CHANNELS].sort()).toEqual(Object.keys(all).sort())
  })
})
