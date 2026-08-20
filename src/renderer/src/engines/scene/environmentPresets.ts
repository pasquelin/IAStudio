/**
 * Ready-made worlds: one click that sets a scene up for the kind of look somebody is after.
 *
 * Each one is a PATCH and not a whole world — it writes the fields it is about and leaves the
 * rest exactly as they were, so choosing « Night » does not quietly take away a ground somebody
 * turned on.
 *
 * None of them touches a NODE. A preset that added a sun would be adding a row to the outliner,
 * an entry to the history and a light to every export; what a preset settles is the environment,
 * and the lights of a scene stay the author's.
 *
 * The colours are document data, not interface: they are what the scene is painted with, and the
 * studio palette has no say in what a night sky looks like.
 */
import {
  ENVIRONMENT_PRESETS,
  STUDIO_ENVIRONMENT,
  type EnvironmentPreset,
  type SceneWorld,
} from '@shared/domain/scene'
import { sameValues } from '@/helpers/objects'

/** Re-exported so the panel and the menu keep reading the list from the module that patches. */
export { ENVIRONMENT_PRESETS, type EnvironmentPreset } from '@shared/domain/scene'

const PATCHES: Record<EnvironmentPreset, Partial<SceneWorld>> = {
  // Nothing flattering anything: an even grey and no grading, which is what an inspection wants.
  neutral: {
    environment: STUDIO_ENVIRONMENT,
    envIntensity: 1,
    envRotation: 0,
    background: { kind: 'color', color: '#4a4a4a' },
    fog: { kind: 'none' },
    toneMapping: 'none',
    exposure: 1,
  },
  // A presentation, still under the studio's own light: filmic grading is what stops a specular
  // highlight from clipping to white the moment the environment is turned up.
  studio: {
    environment: STUDIO_ENVIRONMENT,
    envIntensity: 1.4,
    background: { kind: 'color', color: '#2b2f36' },
    fog: { kind: 'none' },
    toneMapping: 'aces',
    exposure: 1,
  },
  // A single object on a clean, light ground — what a generated model is judged on.
  product: {
    environment: STUDIO_ENVIRONMENT,
    envIntensity: 1.6,
    background: { kind: 'color', color: '#e8e8ea' },
    fog: { kind: 'none' },
    toneMapping: 'aces',
    exposure: 1,
    ground: { visible: true, color: '#d8d8dc', size: 40, opacity: 1, receiveShadow: true },
  },
  // The sky IS the backdrop here, so the background follows the environment rather than a colour;
  // the haze is what gives distance to a set that has any.
  outdoor: {
    envIntensity: 1.8,
    background: { kind: 'environment', blur: 0 },
    fog: { kind: 'linear', color: '#b6c6d8', near: 25, far: 140 },
    toneMapping: 'aces',
    exposure: 1,
  },
  // Dim, and the exposure opened to compensate — turning the environment down alone would just
  // make everything darker, which is not what night looks like.
  night: {
    envIntensity: 0.15,
    background: { kind: 'color', color: '#0b0e14' },
    fog: { kind: 'exp2', color: '#0b0e14', density: 0.015 },
    toneMapping: 'aces',
    exposure: 1.6,
  },
}

export function presetPatch(preset: EnvironmentPreset): Partial<SceneWorld> {
  return PATCHES[preset]
}

/**
 * Whether a world already says what a preset would say. What lets a chosen preset READ as chosen,
 * without storing which one was picked — a stored name would go on claiming « Night » after the
 * first slider moved.
 */
export function matchesPreset(world: SceneWorld, preset: EnvironmentPreset): boolean {
  const wanted: Record<string, unknown> = presetPatch(preset)
  const held: Record<string, unknown> = world

  return Object.keys(wanted).every(key => sameValues(held[key], wanted[key]))
}

/** The preset a world matches, or nothing — which is the honest answer once anything is tuned. */
export function presetOf(world: SceneWorld): EnvironmentPreset | null {
  return ENVIRONMENT_PRESETS.find(preset => matchesPreset(world, preset)) ?? null
}
