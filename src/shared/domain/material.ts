import { isRecord, readBoolean, readNumber } from '../guards'
import { clamp } from '../numeric'
import { readColor } from './color'
import type { TextureSlot } from './scene'
import { normalizeAzimuth } from './angles'

/**
 * A texture is not an image but a set of channels — see spec § 8.5. Each channel is an asset
 * of its own, exactly as Scenario returns them: one job of the texture converter answers with
 * several assets, each typed by its `metadata.type` and tied to its source by `parentId`.
 */
export type PbrChannel =
  'baseColor' | 'normal' | 'roughness' | 'metalness' | 'ao' | 'height' | 'emissive' | 'edge'

export const PBR_CHANNELS: readonly PbrChannel[] = [
  'baseColor',
  'normal',
  'roughness',
  'metalness',
  'ao',
  'height',
  'emissive',
  'edge',
]

export function isPbrChannel(value: unknown): value is PbrChannel {
  return PBR_CHANNELS.some(candidate => candidate === value)
}

/**
 * The slot of a SCENE a channel dresses — `null` for the three a `MeshStandardMaterial` reads
 * elsewhere, or not at all.
 *
 * Its own table rather than the material editor's `slotFor`, which answers seven slots and lives
 * in the renderer where `shared/` cannot reach it — the two must stay in step by hand.
 *
 * **Known blind spot, and it is upstream:** extraction labels four channels only
 * (`CHANNEL_OF_SLOT`, `main/assets/glbTextures.ts`), one of which is `emissive` — so what a
 * model's own pictures can actually fill is `map`, `normalMap` and `aoMap`. `roughness` and
 * `metalness` stay packed in one picture that claims no channel, and answering here does not
 * unpack it.
 */
export function slotForChannel(channel: PbrChannel): TextureSlot | null {
  return SCENE_SLOT_BY_CHANNEL[channel]
}

const SCENE_SLOT_BY_CHANNEL: Record<PbrChannel, TextureSlot | null> = {
  baseColor: 'map',
  normal: 'normalMap',
  roughness: 'roughnessMap',
  metalness: 'metalnessMap',
  ao: 'aoMap',
  height: 'displacementMap',
  emissive: 'emissiveMap',
  edge: null,
}

/**
 * What a channel asset holds, once read off a generation.
 *
 * `inverted` exists because the API answers with a *smoothness* map where the studio stores
 * roughness — they are the same picture read the other way round. The pixels are kept as they
 * arrived, and the flag travels with them: flipping them here would mean a GPU pass in the
 * main process, which has no GPU, and would destroy what the API actually produced.
 */
export type ChannelSource = {
  channel: PbrChannel
  /** Absent unless the pixels read the other way round; there is only one such type. */
  inverted?: true
}

/**
 * Scenario's own channel vocabulary, in `metadata.type`. Two families answer here, and they
 * disagree: the texture converter says smoothness where a textured mesh says roughness.
 *
 * `emissive` is absent because no Scenario model produces one — it is only ever local.
 */
export const CHANNEL_BY_PROVIDER_TYPE: Record<string, ChannelSource> = {
  'texture-albedo': { channel: 'baseColor' },
  'texture-normal': { channel: 'normal' },
  'texture-height': { channel: 'height' },
  'texture-metallic': { channel: 'metalness' },
  'texture-ao': { channel: 'ao' },
  'texture-edge': { channel: 'edge' },
  'texture-smoothness': { channel: 'roughness', inverted: true },
  '3d-texture-albedo': { channel: 'baseColor' },
  '3d-texture-normal': { channel: 'normal' },
  '3d-texture-metallic': { channel: 'metalness' },
  '3d-texture-roughness': { channel: 'roughness' },
}

/**
 * The channel an API asset carries, or `null` when it carries none — a plain generated image,
 * or a type this build has never heard of. Unknown is not an error: the API adds types without
 * warning, and one of them must land in the project as an ordinary picture rather than vanish.
 */
export function channelFromProviderType(metadataType: string | undefined): ChannelSource | null {
  if (metadataType === undefined) return null

  const named = CHANNEL_BY_PROVIDER_TYPE[metadataType]
  if (named) return named

  // A whole surface rather than one channel of one — `texture`, `upscale-texture`, the
  // `inference-*-texture` family. It IS the base colour: dropping such a picture on the preview
  // fills that channel and nothing else, and the panel says so in as many words.
  //
  // 🛑 Not decoration. The studio no longer files a channel under a kind of its own, so `map` is
  // the ONLY thing left saying a picture belongs to a material — a double-click that read no
  // channel here would open the pixels instead of the material, on the commonest generation the
  // Materials space makes.
  return isMaterialPicture(metadataType) ? { channel: 'baseColor' } : null
}

/**
 * A picture OF a material, as opposed to one channel of one. `texture`, `upscale-texture` and
 * the `inference-*-texture` family all describe a whole surface.
 */
export function isMaterialPicture(metadataType: string): boolean {
  return metadataType === 'texture' || metadataType.endsWith('-texture')
}

/** What a seam reading means, in words. A ratio is a number nobody reads without a scale. */
export type SeamVerdict = 'none' | 'faint' | 'visible'

/**
 * The two thresholds, and they are of the picture's own grain rather than of anything absolute:
 * a wrap no worse than the detail already there cannot be seen, and one twice as strong as the
 * detail around it is what the eye lands on first. See `engines/material/derive/seam-shader`.
 */
export function seamVerdict(ratio: number): SeamVerdict {
  if (ratio < 1.2) return 'none'
  return ratio < 2 ? 'faint' : 'visible'
}

export type ValueRange = { min: number; max: number }

export type Vector2 = { x: number; y: number }

/**
 * The shapes a texture is judged on. A plane reads tiling, a sphere reads lighting.
 *
 * Here rather than beside the preview it drives, for the reason the bounds below are: the
 * registry on this side of the boundary offers the list to an outside client, and a copy would
 * be a sixth shape the engine knows and the schema does not.
 */
export type PreviewShape = 'sphere' | 'box' | 'cylinder' | 'plane' | 'torusKnot'

export const PREVIEW_SHAPES: readonly PreviewShape[] = [
  'sphere',
  'box',
  'cylinder',
  'plane',
  'torusKnot',
]

/**
 * How far each setting a slider drives is allowed to go. Here rather than at the field, because
 * the parser has to hold the same bounds: read unclamped, a hand-edited `heightScale: 3` opened
 * and rendered fine, the slider pinned at its own maximum, and the first touch of it destroyed the
 * value — with the two truths far enough apart that nothing pointed at the cause.
 *
 * The four that read through `readUnit` are not here: their bound IS the unit interval.
 */
export const MATERIAL_BOUNDS = {
  normalScale: { min: -2, max: 2, step: 0.05 },
  heightScale: { min: 0, max: 0.5, step: 0.005 },
  emissiveIntensity: { min: 0, max: 4, step: 0.05 },
  // A repeat of zero collapses every map to one texel, and a negative one mirrors it: neither is
  // reachable from the field, so neither may arrive from a file.
  tiling: { min: 0.01, max: 64, step: 0.1 },
}

/**
 * The settings of the preview material. None of them ever touch the pixels of a channel: they
 * are read at render time, which is what lets a value be changed back six months later.
 *
 * `roughnessRange` and `metalnessRange` remap what their map holds — the double handle of the
 * material panel — and are the identity by default.
 *
 * In `shared/` rather than in the texture engine it was written for: a saved style is this shape
 * and nothing else, and the main process — which writes the styles file — has to type what it
 * writes.
 */
export type MaterialSettings = {
  /** Tint multiplied over the base colour map. */
  color: string
  roughness: number
  metalness: number
  roughnessRange: ValueRange
  metalnessRange: ValueRange
  normalScale: number
  /** OpenGL and DirectX disagree on which way the green channel points. */
  invertNormalGreen: boolean
  /** Displacement, off by default: a subdivided sphere costs more than the scene it previews. */
  heightScale: number
  aoIntensity: number
  /** How much the cavity mask darkens edges, read in `onBeforeCompile`. */
  edgeIntensity: number
  emissive: string
  emissiveIntensity: number
  /** Repeat, applied to every channel at once: applied to one alone, the maps drift apart. */
  tiling: Vector2
  offset: Vector2
  /** Radians. */
  rotation: number
}

/**
 * Frozen down to its nested objects, and not only for its own sake: a panel that resets one row
 * writes `{ ...DEFAULT_TEXTURE_MATERIAL, roughness }`, and a spread copies the reference to
 * `tiling` — one drag on the copy would then move the default every other texture opens on.
 */
export const DEFAULT_TEXTURE_MATERIAL: MaterialSettings = {
  color: '#ffffff',
  roughness: 1,
  metalness: 0,
  roughnessRange: Object.freeze({ min: 0, max: 1 }),
  metalnessRange: Object.freeze({ min: 0, max: 1 }),
  normalScale: 1,
  invertNormalGreen: false,
  heightScale: 0,
  aoIntensity: 1,
  edgeIntensity: 0,
  emissive: '#000000',
  emissiveIntensity: 1,
  tiling: Object.freeze({ x: 1, y: 1 }),
  offset: Object.freeze({ x: 0, y: 0 }),
  rotation: 0,
}

Object.freeze(DEFAULT_TEXTURE_MATERIAL)

/**
 * Read like every other value, then held inside what the value means. A hand-edited `.mtlx` is
 * user territory, and a roughness of -1 reaches the GGX term as a negative alpha: black or white
 * pixels depending on the driver, with nothing on the way to say where it came from.
 */
function readUnit(source: Record<string, unknown>, key: string, fallback: number): number {
  return clamp(readNumber(source, key, fallback), 0, 1)
}

/** Held inside what a slider can reach, so a file and its own field cannot disagree. */
function readBounded(
  source: Record<string, unknown>,
  key: string,
  fallback: number,
  bound: keyof typeof MATERIAL_BOUNDS,
): number {
  const { min, max } = MATERIAL_BOUNDS[bound]
  return clamp(readNumber(source, key, fallback), min, max)
}

/** Kept in order as well as in range: handles crossed over would remap everything to nothing. */
function readRange(source: Record<string, unknown>, key: string, fallback: ValueRange): ValueRange {
  const raw = source[key]
  if (!isRecord(raw)) return { ...fallback }

  const min = readUnit(raw, 'min', fallback.min)
  return { min, max: clamp(readNumber(raw, 'max', fallback.max), min, 1) }
}

/** Held above zero on both axes, which is the one thing `readVector` cannot know to do. */
function readTiling(source: Record<string, unknown>, fallback: Vector2): Vector2 {
  const { min, max } = MATERIAL_BOUNDS.tiling
  const raw = readVector(source, 'tiling', fallback)
  return { x: clamp(raw.x, min, max), y: clamp(raw.y, min, max) }
}

function readVector(source: Record<string, unknown>, key: string, fallback: Vector2): Vector2 {
  const raw = source[key]
  if (!isRecord(raw)) return { ...fallback }
  return { x: readNumber(raw, 'x', fallback.x), y: readNumber(raw, 'y', fallback.y) }
}

/**
 * A material read back from anything at all — a `.mtlx` the user edited, a styles file restored
 * from a backup. Total: what reads as nothing opens on the defaults rather than throwing.
 */
export function readMaterial(value: unknown): MaterialSettings {
  const fallback = DEFAULT_TEXTURE_MATERIAL
  if (!isRecord(value)) return structuredClone(fallback)

  return {
    color: readColor(value, 'color', fallback.color),
    roughness: readUnit(value, 'roughness', fallback.roughness),
    metalness: readUnit(value, 'metalness', fallback.metalness),
    roughnessRange: readRange(value, 'roughnessRange', fallback.roughnessRange),
    metalnessRange: readRange(value, 'metalnessRange', fallback.metalnessRange),
    // Signed on purpose: a negative scale flips the relief, which is a legitimate answer to a
    // normal map baked the other way round — hence a bound that is not the unit interval.
    normalScale: readBounded(value, 'normalScale', fallback.normalScale, 'normalScale'),
    invertNormalGreen: readBoolean(value, 'invertNormalGreen', fallback.invertNormalGreen),
    heightScale: readBounded(value, 'heightScale', fallback.heightScale, 'heightScale'),
    aoIntensity: readUnit(value, 'aoIntensity', fallback.aoIntensity),
    edgeIntensity: readUnit(value, 'edgeIntensity', fallback.edgeIntensity),
    emissive: readColor(value, 'emissive', fallback.emissive),
    emissiveIntensity: readBounded(
      value,
      'emissiveIntensity',
      fallback.emissiveIntensity,
      'emissiveIntensity',
    ),
    tiling: readTiling(value, fallback.tiling),
    // Offset is left alone: it is cyclic and three wraps it, so 1.5 means the same as 0.5.
    offset: readVector(value, 'offset', fallback.offset),
    // Wrapped, not clamped. An angle is cyclic, so `rotation: 100` means something — a clamp to
    // 2PI would throw away what the author wrote, where wrapping keeps it.
    rotation: normalizeAzimuth(readNumber(value, 'rotation', fallback.rotation)),
  }
}
