import { describe, expect, it } from 'vitest'
import { COMMAND_REGISTRY, commandDescriptor } from './command'
import { DEFAULT_MOTION } from './shortcut'
import {
  NAVIGATION_PRESETS,
  SCHEME_OF,
  schemeFor,
  type CustomNavigation,
  type NavigationPreset,
} from './navigationPreset'

/** What a command answers to under a preset — the studio's key unless the preset moves it. */
function keyOf(
  id: string,
  preset: NavigationPreset,
  custom: CustomNavigation = MILD,
): string | null {
  const layer = schemeFor(preset, custom).bindings
  return layer[id as never] ?? commandDescriptor(id)?.defaultBinding ?? null
}

/** A scheme of one's own that holds no letter — the shape every case below reads by default. */
const MILD: CustomNavigation = { orbit: 'leftAlt', pan: 'middle', fly: 'anyButton' }

/** The same, turned permanent: the one setting a person can make that costs two commands. */
const PERMANENT: CustomNavigation = { orbit: 'leftAlt', pan: 'middle', fly: 'always' }

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
      if (schemeFor(preset, MILD).fly !== 'always') return

      const taken: string[] = []
      for (const one of COMMAND_REGISTRY.filter(each => each.scope === 'scene')) {
        const key = keyOf(one.id, preset)
        if (!key) continue
        // Only the three modifiers `motionFor` REFUSES are safe. Shift is boost, so ⇧A reads as
        // boost-strafe-left and is swallowed whole — the reading this guard used to get wrong.
        if (/(^|\+)(Meta|Ctrl|Alt)\+/.test(key)) continue
        const bare = key.replace(/^Shift\+/, '')
        if (bare.includes('+')) continue
        if (FLOWN.has(bare)) taken.push(`${one.id} on ${key} (qwerty)`)
        if (AZERTY_AT[bare] && FLOWN.has(AZERTY_AT[bare])) {
          taken.push(`${one.id} on ${key} (azerty)`)
        }
      }
      expect(taken).toEqual([])
    },
  )

  /**
   * The hole `custom` opened and this closes: the cost of a permanent flight follows the MODE,
   * not the application. A scheme of one's own set to `always` swallowed `scene.scale` before,
   * because it carried no layer of its own to move it out of the way.
   */
  it('moves the same two commands for a scheme of one’s own turned permanent', () => {
    const taken = COMMAND_REGISTRY.filter(one => one.scope === 'scene')
      .map(one => keyOf(one.id, 'custom', PERMANENT))
      .filter((key): key is string => key !== null)
      .filter(key => !/(^|\+)(Meta|Ctrl|Alt)\+/.test(key))
      .map(key => key.replace(/^Shift\+/, ''))
      .filter(key => !key.includes('+'))
      .filter(key => FLOWN.has(key) || (AZERTY_AT[key] && FLOWN.has(AZERTY_AT[key])))

    expect(taken).toEqual([])
    // And it costs nothing while a button is held, which is what the default is.
    expect(keyOf('scene.scale', 'custom', MILD)).toBe('KeyS')
  })

  it('keeps the studio preset as the one every other falls back to', () => {
    expect(SCHEME_OF.studio.bindings).toEqual({})
  })
})

describe('a scheme of one’s own', () => {
  /**
   * The two are picked on separate rows and `gestureOf` reads pan first: named alike, the
   * viewport simply stopped turning, with nothing anywhere saying why.
   */
  it('keeps its orbit when the same chord is named for both, and still pans', () => {
    const both = schemeFor('custom', { orbit: 'middle', pan: 'middle', fly: 'anyButton' })

    expect(both.orbit).not.toEqual([])
    // Emptied, it took panning away in silence — and naming the middle button for both is two
    // clicks from the default. What is left falls back on the chord Blender pans with.
    expect(both.pan).not.toEqual([])
    expect(both.pan).not.toEqual(both.orbit)
  })

  it('leaves the two apart when they are different', () => {
    const apart = schemeFor('custom', { orbit: 'leftAlt', pan: 'middle', fly: 'anyButton' })

    expect(apart.orbit).not.toEqual([])
    expect(apart.pan).not.toEqual([])
  })
})
