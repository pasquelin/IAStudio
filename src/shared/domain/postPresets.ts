/**
 * The compositions the studio ships with, and the file two projects exchange one through.
 *
 * A preset is code, like a scene template: no file to fetch, nothing to install. What it holds is
 * a stack — which effects, in which order, on which values — and it is applied by BUILDING that
 * stack, never by pointing at it. A document that referenced a preset would change look the day
 * the preset did.
 */
import { isRecord } from '../guards'
import {
  boundParam,
  POST_EFFECTS,
  readStack,
  unknownEffectsIn,
  type PostEffectId,
  type PostParamValue,
  type PostStack,
} from './postProcessing'

/** One line of a preset: an effect, and only the values it disagrees with its defaults on. */
export type PostPresetStep = {
  effect: PostEffectId
  params?: Readonly<Record<string, PostParamValue>>
}

export type PostPresetId =
  | 'none'
  | 'natural'
  | 'studio'
  | 'cinematic'
  | 'cinematicWarm'
  | 'cinematicCold'
  | 'dream'
  | 'horror'
  | 'cyberpunk'
  | 'vintageFilm'
  | 'productShot'
  | 'game'

/**
 * `Record` keyed on the union: a preset named without a recipe fails to compile.
 *
 * The values are not decoration. Each of these was written as a LOOK — an occlusion pass to sit
 * things on the ground, a bloom whose threshold is above the diffuse range so only emissives
 * bloom, a grade that moves contrast and saturation together, and a vignette that closes it.
 * A preset that switched effects on without agreeing values would be worse than none.
 */
export const POST_PRESETS: Record<PostPresetId, readonly PostPresetStep[]> = {
  none: [],

  natural: [
    { effect: 'colorGrading', params: { contrast: 1.04, saturation: 1.02 } },
    { effect: 'smaa' },
  ],

  studio: [
    { effect: 'gtao', params: { radius: 0.2, blend: 0.7 } },
    { effect: 'bloom', params: { strength: 0.25, radius: 0.3, threshold: 1 } },
    { effect: 'colorGrading', params: { contrast: 1.08, saturation: 1.06, gain: 1.02 } },
    { effect: 'smaa' },
  ],

  cinematic: [
    { effect: 'gtao', params: { radius: 0.3, blend: 0.85 } },
    { effect: 'bloom', params: { strength: 0.5, radius: 0.5, threshold: 0.9 } },
    {
      effect: 'colorGrading',
      params: { contrast: 1.18, saturation: 0.94, gamma: 1.03, lift: 0.02 },
    },
    { effect: 'vignette', params: { offset: 0.9, darkness: 1.15 } },
    { effect: 'filmGrain', params: { intensity: 0.12, size: 1.2 } },
    { effect: 'smaa' },
  ],

  cinematicWarm: [
    { effect: 'gtao', params: { radius: 0.3, blend: 0.85 } },
    { effect: 'bloom', params: { strength: 0.55, radius: 0.55, threshold: 0.85 } },
    {
      effect: 'colorGrading',
      params: { contrast: 1.16, saturation: 1.02, temperature: 0.28, tint: 0.06, lift: 0.03 },
    },
    { effect: 'vignette', params: { offset: 0.9, darkness: 1.1 } },
    { effect: 'filmGrain', params: { intensity: 0.12, size: 1.2 } },
    { effect: 'smaa' },
  ],

  cinematicCold: [
    { effect: 'gtao', params: { radius: 0.3, blend: 0.9 } },
    { effect: 'bloom', params: { strength: 0.45, radius: 0.5, threshold: 0.95 } },
    {
      effect: 'colorGrading',
      params: { contrast: 1.22, saturation: 0.88, temperature: -0.32, tint: 0.08, gamma: 1.05 },
    },
    { effect: 'vignette', params: { offset: 0.85, darkness: 1.25 } },
    { effect: 'filmGrain', params: { intensity: 0.1, size: 1.1 } },
    { effect: 'smaa' },
  ],

  dream: [
    { effect: 'bloom', params: { strength: 1.4, radius: 1.1, threshold: 0.55 } },
    { effect: 'chromaticAberration', params: { amount: 0.0022 } },
    {
      effect: 'colorGrading',
      params: { contrast: 0.92, saturation: 1.18, lift: 0.07, gamma: 1.08, temperature: 0.12 },
    },
    { effect: 'vignette', params: { offset: 1.2, darkness: 0.7 } },
    { effect: 'smaa' },
  ],

  horror: [
    { effect: 'gtao', params: { radius: 0.45, blend: 1, distanceExponent: 1.4 } },
    {
      effect: 'colorGrading',
      params: { exposure: -0.55, contrast: 1.34, saturation: 0.55, temperature: -0.14, gamma: 1.1 },
    },
    { effect: 'sharpen', params: { amount: 0.4 } },
    { effect: 'vignette', params: { offset: 0.6, darkness: 1.9 } },
    { effect: 'filmGrain', params: { intensity: 0.42, size: 1.6 } },
    { effect: 'smaa' },
  ],

  cyberpunk: [
    { effect: 'bloom', params: { strength: 1.15, radius: 0.75, threshold: 0.7 } },
    { effect: 'chromaticAberration', params: { amount: 0.0035 } },
    {
      effect: 'colorGrading',
      params: { contrast: 1.24, saturation: 1.32, temperature: -0.3, tint: 0.26, lift: 0.03 },
    },
    { effect: 'vignette', params: { offset: 0.8, darkness: 1.3 } },
    { effect: 'filmGrain', params: { intensity: 0.1, size: 1 } },
    { effect: 'smaa' },
  ],

  vintageFilm: [
    // A low threshold with a small radius is halation — the glow an emulsion puts around a
    // highlight — rather than the wide bloom a lens gives.
    { effect: 'bloom', params: { strength: 0.4, radius: 0.25, threshold: 0.6 } },
    {
      effect: 'colorGrading',
      params: {
        contrast: 1.06,
        saturation: 0.76,
        temperature: 0.3,
        tint: 0.1,
        lift: 0.06,
        gamma: 1.12,
      },
    },
    { effect: 'vignette', params: { offset: 0.7, darkness: 1.5 } },
    { effect: 'filmGrain', params: { intensity: 0.48, size: 1.8 } },
    { effect: 'smaa' },
  ],

  productShot: [
    { effect: 'gtao', params: { radius: 0.15, blend: 0.6, samples: 24 } },
    { effect: 'bloom', params: { strength: 0.2, radius: 0.25, threshold: 1.05 } },
    { effect: 'colorGrading', params: { contrast: 1.1, saturation: 1.08, gain: 1.04 } },
    { effect: 'sharpen', params: { amount: 0.35 } },
    { effect: 'smaa' },
  ],

  game: [
    { effect: 'bloom', params: { strength: 0.7, radius: 0.45, threshold: 0.8 } },
    { effect: 'colorGrading', params: { contrast: 1.12, saturation: 1.1 } },
    { effect: 'vignette', params: { offset: 1, darkness: 0.8 } },
    // FXAA rather than SMAA: a game look is the one that buys its edges at the lowest price.
    { effect: 'fxaa' },
  ],
}

export const POST_PRESET_IDS: readonly PostPresetId[] = Object.keys(
  POST_PRESETS,
) as readonly PostPresetId[]

export function isPostPresetId(value: unknown): value is PostPresetId {
  return typeof value === 'string' && value in POST_PRESETS
}

/**
 * A preset, as a stack ready to be put into a document.
 *
 * Every parameter is filled from the effect's own defaults and then overwritten by what the
 * recipe names — and each one goes through `boundParam`, so a recipe that drifted out of the
 * spec of an effect it uses is corrected rather than written into a document.
 */
export function stackFromPreset(id: PostPresetId, mintId: () => string): PostStack {
  return {
    enabled: true,
    effects: POST_PRESETS[id].map(step => ({
      id: mintId(),
      effect: step.effect,
      enabled: true,
      params: Object.fromEntries(
        Object.entries(POST_EFFECTS[step.effect].params).map(([key, spec]) => [
          key,
          key in (step.params ?? {}) ? boundParam(spec, step.params?.[key]) : spec.default,
        ]),
      ),
    })),
  }
}

/** What a preset the person saved on this machine holds. */
export type UserPostPreset = {
  id: string
  name: string
  stack: PostStack
}

export const POST_PRESET_FILE_TYPE = 'post-processing-preset'

/** Bumped when the shape below changes in a way an older reader cannot ignore. */
export const POST_PRESET_VERSION = 1

/**
 * The file two projects exchange a look through.
 *
 * It carries ids, switches and numbers — nothing that can be run. There is deliberately no room
 * in this shape for a shader, a script or a path: an effect is a member of `PostEffectId`, which
 * is code, so a file can only ever NAME one this build already has (§ 12).
 */
export type PostPresetFile = {
  type: typeof POST_PRESET_FILE_TYPE
  version: number
  name: string
  stack: PostStack
}

export function postPresetFile(name: string, stack: PostStack): PostPresetFile {
  return { type: POST_PRESET_FILE_TYPE, version: POST_PRESET_VERSION, name, stack }
}

export type PostPresetRead =
  | { ok: true; name: string; stack: PostStack; dropped: readonly string[] }
  | { ok: false; reason: 'shape' | 'version' }

/**
 * A preset file, read back.
 *
 * A version from the FUTURE is refused rather than guessed at; a version from the past is read
 * by the current reader, which fills every field it knows and ignores every field it does not.
 * Effects this build has no code for are dropped and NAMED, so the import can say what was lost
 * instead of quietly showing a different picture.
 */
export function readPostPresetFile(payload: unknown, mintId: () => string): PostPresetRead {
  if (!isRecord(payload) || payload.type !== POST_PRESET_FILE_TYPE)
    return { ok: false, reason: 'shape' }

  const version = payload.version
  if (typeof version !== 'number' || !Number.isFinite(version))
    return { ok: false, reason: 'shape' }
  if (version > POST_PRESET_VERSION) return { ok: false, reason: 'version' }

  return {
    ok: true,
    name: typeof payload.name === 'string' ? payload.name : '',
    stack: readStack(payload.stack, mintId),
    dropped: unknownEffectsIn(payload.stack),
  }
}
