/**
 * The half of a scene document that belongs to no node — what lights it, what hangs behind it,
 * how it is brought down to a screen — as a saved file writes and reads it.
 *
 * Apart from `sceneDocument.ts`, which reads the NODES: the two answer different questions and
 * only one of them has to walk a spec table per primitive.
 */
import {
  BACKGROUND_BLUR,
  DEFAULT_BACKGROUND,
  DEFAULT_EXP2_FOG,
  DEFAULT_GROUND,
  DEFAULT_LINEAR_FOG,
  DEFAULT_PLAY,
  DEFAULT_WORLD,
  ENV_INTENSITY,
  EXPOSURE,
  EYE_HEIGHT,
  FOG_DENSITY,
  GRAVITY,
  GROUND_SIZE,
  MOVE_SPEED,
  NO_FOG,
  PLAY_CAMERAS,
  readEnvironment,
  STUDIO_ENVIRONMENT,
  TONE_MAPPINGS,
  type BackgroundDescriptor,
  type EnvironmentRef,
  type FogDescriptor,
  type GroundDescriptor,
  type ScenePlay,
  type SceneWorld,
} from '@shared/domain/scene'
import { isRecord, oneOf, readBoolean, readNumber, readString } from '@shared/guards'
import { bound, type NumericBounds } from '@shared/numeric'

/**
 * What a stored value says about the world, filled in from the defaults wherever it says nothing
 * usable.
 *
 * `legacyEnvironment` is where the sky lived until this type existed — at the root of the payload
 * rather than in here. Every document written so far spells it that way, and reading it is the
 * whole of the migration: nothing is rewritten until the next save.
 */
export function readWorld(value: unknown, legacyEnvironment: unknown): SceneWorld {
  const held = isRecord(value) ? value : {}

  return {
    // The nested one wins when it is there; a file that only has the old root key keeps its sky.
    environment: readEnvironment('environment' in held ? held.environment : legacyEnvironment),
    envIntensity: readBounded(held, 'envIntensity', DEFAULT_WORLD.envIntensity, ENV_INTENSITY),
    // Unbounded on purpose: an angle wraps, so no value of it is wrong.
    envRotation: readNumber(held, 'envRotation', DEFAULT_WORLD.envRotation),
    background: readBackground(held.background),
    fog: readFog(held.fog),
    toneMapping: oneOf(TONE_MAPPINGS, held.toneMapping, DEFAULT_WORLD.toneMapping),
    exposure: readBounded(held, 'exposure', DEFAULT_WORLD.exposure, EXPOSURE),
    ground: readGround(held.ground),
    play: readPlay(held.play),
  }
}

function readBounded(
  source: Record<string, unknown>,
  key: string,
  fallback: number,
  bounds: NumericBounds,
): number {
  return bound(readNumber(source, key, fallback), bounds)
}

function readBackground(value: unknown): BackgroundDescriptor {
  if (!isRecord(value)) return DEFAULT_WORLD.background
  if (value.kind === 'transparent') return { kind: 'transparent' }
  // Every document written before the softening exists says nothing about it, and nothing is
  // exactly what it was: sharp.
  if (value.kind !== 'color')
    return { kind: 'environment', blur: readBounded(value, 'blur', 0, BACKGROUND_BLUR) }

  // A colour background with no colour in it is not a colour background: it would paint black
  // over whatever the document meant, which is the one outcome nobody asked for.
  const color = readString(value, 'color', '')
  return color === '' ? DEFAULT_WORLD.background : { kind: 'color', color }
}

function readFog(value: unknown): FogDescriptor {
  if (!isRecord(value)) return NO_FOG

  if (value.kind === 'linear') {
    return {
      kind: 'linear',
      color: readString(value, 'color', DEFAULT_LINEAR_FOG.color),
      near: readNumber(value, 'near', 10),
      far: readNumber(value, 'far', 60),
    }
  }
  if (value.kind === 'exp2') {
    return {
      kind: 'exp2',
      color: readString(value, 'color', DEFAULT_EXP2_FOG.color),
      density: readBounded(value, 'density', 0.02, FOG_DENSITY),
    }
  }
  return NO_FOG
}

/**
 * The play settings a file holds. Read like everything else here although nothing flies a scene
 * yet: a document written by a template says how it means to be walked, and a reader that
 * dropped it would lose that at the first save.
 */
function readPlay(value: unknown): ScenePlay {
  if (!isRecord(value)) return DEFAULT_PLAY

  return {
    camera: oneOf(PLAY_CAMERAS, value.camera, DEFAULT_PLAY.camera),
    eyeHeight: readBounded(value, 'eyeHeight', DEFAULT_PLAY.eyeHeight, EYE_HEIGHT),
    moveSpeed: readBounded(value, 'moveSpeed', DEFAULT_PLAY.moveSpeed, MOVE_SPEED),
    gravity: readBounded(value, 'gravity', DEFAULT_PLAY.gravity, GRAVITY),
  }
}

function readGround(value: unknown): GroundDescriptor {
  if (!isRecord(value)) return DEFAULT_GROUND

  const color = value.color
  return {
    visible: readBoolean(value, 'visible', DEFAULT_GROUND.visible),
    color: typeof color === 'string' && color !== '' ? color : null,
    size: readBounded(value, 'size', DEFAULT_GROUND.size, GROUND_SIZE),
    opacity: readBounded(value, 'opacity', DEFAULT_GROUND.opacity, { min: 0, max: 1 }),
    receiveShadow: readBoolean(value, 'receiveShadow', DEFAULT_GROUND.receiveShadow),
  }
}

/**
 * A fog switched to another form, keeping the colour the previous one wore.
 *
 * The colour and nothing else: a `near`/`far` pair says nothing about a density, and carrying
 * numbers across would give one form the settings of the other.
 */
export function fogOfKind(kind: FogDescriptor['kind'], previous: FogDescriptor): FogDescriptor {
  if (kind === 'none') return NO_FOG
  const color = previous.kind === 'none' ? DEFAULT_LINEAR_FOG.color : previous.color

  return kind === 'linear' ? { ...DEFAULT_LINEAR_FOG, color } : { ...DEFAULT_EXP2_FOG, color }
}

/** What the project offers to light a scene with: its equirectangular pictures, and its skies. */
export type EnvironmentOffer = {
  pictures: readonly { id: string }[]
  skies: readonly { id: string }[]
}

/**
 * What lights a scene, switched to another source. Both of the other two are REFERENCES, so each
 * is only an answer while the project holds one: with none, this stays on the studio rather than
 * writing a reference to nothing.
 *
 * Nothing is carried across, unlike the two below — the studio has no id to remember a sky by,
 * so coming back lands on the project's first one again.
 */
export function environmentOfKind(
  kind: EnvironmentRef['kind'],
  offered: EnvironmentOffer,
): EnvironmentRef {
  if (kind === 'skybox') {
    const first = offered.pictures[0]
    return first ? { kind: 'skybox', assetId: first.id } : STUDIO_ENVIRONMENT
  }

  if (kind === 'sky') {
    const first = offered.skies[0]
    return first ? { kind: 'sky', documentId: first.id } : STUDIO_ENVIRONMENT
  }

  return STUDIO_ENVIRONMENT
}

/** What a colour backdrop opens on when none was ever chosen — a mid grey, flattering nothing. */
const FIRST_BACKDROP = '#4a4a4a'

/**
 * A backdrop switched to another form, keeping the colour the previous one wore — the same rule
 * as `fogOfKind`, and here rather than in the panel for the same reason: it is a decision about
 * the document, and a decision written in JSX is a decision no test reaches.
 */
export function backgroundOfKind(
  kind: BackgroundDescriptor['kind'],
  previous: BackgroundDescriptor,
): BackgroundDescriptor {
  if (kind === 'environment') return DEFAULT_BACKGROUND
  if (kind === 'transparent') return { kind: 'transparent' }

  return { kind: 'color', color: previous.kind === 'color' ? previous.color : FIRST_BACKDROP }
}
