import { describe, expect, it } from 'vitest'
import { COMMAND_REGISTRY, commandDescriptor } from './command'
import { DEFAULT_MOTION } from './shortcut'
import { NAVIGATION_PRESETS, SCHEME_OF, type NavigationPreset } from './navigationPreset'

/** What a command answers to under a preset — the studio's key unless the preset moves it. */
function keyOf(id: string, preset: NavigationPreset): string | null {
  return SCHEME_OF[preset].bindings[id as never] ?? commandDescriptor(id)?.defaultBinding ?? null
}

/**
 * The three letters AZERTY swaps with QWERTY. A binding is signed by the CHARACTER printed on a
 * key, a flight motion is read by its POSITION — so the two only collide on one layout.
 *
 * 🛑 Blind spot, written rather than hidden: this covers the three letter swaps and nothing else.
 * A layout that moves punctuation, or QWERTZ, is not read here.
 */
const AZERTY_AT: Record<string, string> = { KeyA: 'KeyQ', KeyQ: 'KeyA', KeyW: 'KeyZ', KeyZ: 'KeyW' }

/** Every position a flight reads, whatever the layout — `DEFAULT_MOTION` is spelled in codes. */
const FLOWN = new Set(Object.values(DEFAULT_MOTION).flat())

describe('the navigation presets', () => {
  it.each(NAVIGATION_PRESETS)('leaves no command of %s without a key', preset => {
    const lost = COMMAND_REGISTRY.filter(one => one.defaultBinding && !keyOf(one.id, preset))
    expect(lost.map(one => one.id)).toEqual([])
  })

  it.each(NAVIGATION_PRESETS)('gives no two commands of %s the same key in one scope', preset => {
    const clashes: string[] = []
    for (const scope of new Set(COMMAND_REGISTRY.map(one => one.scope))) {
      const seen = new Map<string, string>()
      for (const one of COMMAND_REGISTRY.filter(each => each.scope === scope)) {
        const key = keyOf(one.id, preset)
        if (!key) continue
        const held = seen.get(key)
        if (held) clashes.push(`${scope}: ${held} and ${one.id} both on ${key}`)
        seen.set(key, one.id)
      }
    }
    expect(clashes).toEqual([])
  })

  /**
   * The whole cost of a preset that hands the letters to the camera with nothing held. Read on
   * BOTH layouts: `scene.display` is bound to the character `z`, which sits where `forward` is
   * on AZERTY and nowhere near it on QWERTY.
   */
  it.each(NAVIGATION_PRESETS)(
    'keeps the scene of %s off the keys a permanent flight takes',
    preset => {
      if (SCHEME_OF[preset].fly !== 'always') return

      const taken: string[] = []
      for (const one of COMMAND_REGISTRY.filter(each => each.scope === 'scene')) {
        const key = keyOf(one.id, preset)
        // A chord is safe: a flight reads a bare key, never one under a modifier.
        if (!key || key.includes('+')) continue
        if (FLOWN.has(key)) taken.push(`${one.id} on ${key} (qwerty)`)
        if (AZERTY_AT[key] && FLOWN.has(AZERTY_AT[key])) taken.push(`${one.id} on ${key} (azerty)`)
      }
      expect(taken).toEqual([])
    },
  )

  it('keeps the studio preset as the one every other falls back to', () => {
    expect(SCHEME_OF.studio.bindings).toEqual({})
  })
})
