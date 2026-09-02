import type { BindingOverrides } from './command'

/**
 * How each 3D application people already know drives its viewport, as data.
 *
 * A preset is a PARTIAL layer: it declares only what its application does differently, and
 * everything it says nothing about falls back to the studio's own. That is what lets IA Studio
 * keep the commands the others have no equivalent for, whichever preset is chosen.
 *
 * Resolution, in order: the studio's default, then the preset, then what the person remapped —
 * which always wins. See `bindingOf`.
 */
export type NavigationPreset = 'studio' | 'unreal' | 'unity' | 'blender' | 'roblox'

export const NAVIGATION_PRESETS: readonly NavigationPreset[] = [
  'studio',
  'unreal',
  'unity',
  'blender',
  'roblox',
]

/**
 * When the movement keys belong to the camera.
 *
 * `always` is Roblox's, and it is the one that COSTS something: the letters stop being available
 * to the scene's commands, which is precisely why Unity and Unreal gate theirs behind a button.
 */
export type FlyMode = 'anyButton' | 'rightButton' | 'always'

/** A mouse gesture, spelled as the parts a `PointerEvent` carries. */
export type GestureChord = {
  /** 0 left, 1 middle, 2 right — as `PointerEvent.button` numbers them. */
  button: number
  alt?: boolean
  shift?: boolean
  ctrl?: boolean
}

export type NavigationScheme = {
  orbit: readonly GestureChord[]
  pan: readonly GestureChord[]
  fly: FlyMode
  /** Only what THIS application binds differently. Everything absent keeps the studio's key. */
  bindings: BindingOverrides
}

/** The three verbs every one of them puts on the same three keys — or does not. */
const UNITY_TOOLS: BindingOverrides = {
  'scene.translate': 'KeyW',
  'scene.rotate': 'KeyE',
  'scene.scale': 'KeyR',
}

export const SCHEME_OF: Record<NavigationPreset, NavigationScheme> = {
  /**
   * The studio's own, and the DEFAULT. Its layer is empty by construction: it IS the fallback
   * every other preset falls back to, so choosing it resets the keys to what the repo declares.
   */
  studio: {
    orbit: [{ button: 0 }, { button: 0, alt: true }],
    pan: [{ button: 1 }, { button: 0, alt: true, shift: true }],
    fly: 'anyButton',
    bindings: {},
  },
  unreal: {
    orbit: [{ button: 0, alt: true }],
    pan: [{ button: 1 }],
    fly: 'rightButton',
    bindings: UNITY_TOOLS,
  },
  unity: {
    orbit: [{ button: 0, alt: true }],
    pan: [{ button: 1 }, { button: 1, alt: true }],
    fly: 'rightButton',
    bindings: UNITY_TOOLS,
  },
  /**
   * The one that orbits on the MIDDLE button, where the other three pan with it. Its transform
   * verbs are already the studio's — `G` `R` `S` came from here — so its layer only moves the
   * walk mode onto the chord Blender gives it.
   */
  blender: {
    orbit: [{ button: 1 }],
    pan: [{ button: 1, shift: true }],
    fly: 'anyButton',
    bindings: { 'scene.navigate': 'Shift+Backquote' },
  },
  /**
   * The only one where the letters are the camera's with nothing held — and so the only one that
   * has to MOVE the two commands they would otherwise take. `scene.display` is the subtle one:
   * its key is the character `z`, which on AZERTY sits where `forward` is read by POSITION.
   */
  roblox: {
    orbit: [{ button: 0, alt: true }],
    pan: [{ button: 1 }],
    fly: 'always',
    bindings: { 'scene.scale': 'KeyT', 'scene.display': 'KeyK' },
  },
}
