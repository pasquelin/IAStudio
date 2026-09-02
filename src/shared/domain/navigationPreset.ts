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
export type NavigationPreset = 'studio' | 'unreal' | 'unity' | 'blender' | 'roblox' | 'custom'

export const NAVIGATION_PRESETS: readonly NavigationPreset[] = [
  'studio',
  'unreal',
  'unity',
  'blender',
  'roblox',
  'custom',
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

/**
 * What a flight with nothing held has to move out of its way, whichever scheme asks for it.
 *
 * `scene.display` is the subtle one: its key is the character `z`, which on AZERTY sits where
 * `forward` is read by POSITION — a binding is signed by the character, a motion by the place.
 */
const DISPLACED_BY_A_PERMANENT_FLIGHT: BindingOverrides = {
  'scene.scale': 'KeyT',
  'scene.display': 'KeyK',
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
    bindings: DISPLACED_BY_A_PERMANENT_FLIGHT,
  },
  /** Never read through this table — `schemeFor` composes it. Here so the record is complete. */
  custom: {
    orbit: [{ button: 0, alt: true }],
    pan: [{ button: 1 }],
    fly: 'anyButton',
    bindings: {},
  },
}

/**
 * The three gestures a person may put where they like, each a NAMED chord rather than a free
 * capture: a choice is a descriptor the settings screen already draws, where recording a chord
 * would be an interface of its own — and one gesture per row is all any of the five presets uses.
 */
export type CustomOrbit = 'leftAlt' | 'left' | 'middle'
export type CustomPan = 'middle' | 'middleShift' | 'leftAltShift'

export const CUSTOM_ORBITS: readonly CustomOrbit[] = ['leftAlt', 'left', 'middle']
export const CUSTOM_PANS: readonly CustomPan[] = ['middle', 'middleShift', 'leftAltShift']
export const FLY_MODES: readonly FlyMode[] = ['anyButton', 'rightButton', 'always']

const ORBIT_CHORD: Record<CustomOrbit, readonly GestureChord[]> = {
  leftAlt: [{ button: 0, alt: true }],
  left: [{ button: 0 }, { button: 0, alt: true }],
  middle: [{ button: 1 }],
}

const PAN_CHORD: Record<CustomPan, readonly GestureChord[]> = {
  middle: [{ button: 1 }],
  middleShift: [{ button: 1, shift: true }],
  leftAltShift: [{ button: 0, alt: true, shift: true }],
}

/** What a person's own scheme is made of. Their KEYS need nothing here: `shortcuts.overrides` is
 * already the layer above every preset, so it is custom whichever one is chosen. */
export type CustomNavigation = {
  orbit: CustomOrbit
  pan: CustomPan
  fly: FlyMode
}

/**
 * The scheme in force. `custom` is composed from what the person chose; every other preset is
 * the table declared above, and neither carries bindings for `custom` — see `CustomNavigation`.
 */
export function schemeFor(preset: NavigationPreset, custom: CustomNavigation): NavigationScheme {
  if (preset !== 'custom') return SCHEME_OF[preset]

  return {
    orbit: ORBIT_CHORD[custom.orbit],
    pan: PAN_CHORD[custom.pan],
    fly: custom.fly,
    // The cost of `always` follows the MODE, not the application that asked for it: a scheme of
    // one's own that hands the letters to the camera swallows the same two commands.
    bindings: custom.fly === 'always' ? DISPLACED_BY_A_PERMANENT_FLIGHT : {},
  }
}
