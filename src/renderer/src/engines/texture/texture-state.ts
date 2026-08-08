/**
 * A texture, as plain data. It holds no three.js object and no image: an engine is rebuilt from
 * its serialized state, and what a `.tex` stores has to be something a reload can resolve again.
 *
 * The channels themselves are assets of the project, referenced by id. The renderer has no
 * `fs`, and a file path written into a document would stop the project folder from being moved.
 */
import { isRecord, readBoolean, readNumber, readPositive, readString } from '@shared/guards'
import { readEnvironment, type EnvironmentRef } from '@shared/domain/scene'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { clamp } from '@/helpers/numeric'

/**
 * The `MeshStandardMaterial` property a channel feeds. Named here rather than borrowed from the
 * 3D space: the two spaces are independent, and a texture that changed what a scene inspector
 * shows would be a link neither of them asked for.
 */
export type MaterialSlot =
  | 'map'
  | 'normalMap'
  | 'roughnessMap'
  | 'metalnessMap'
  | 'aoMap'
  | 'displacementMap'
  | 'emissiveMap'

const SLOT_BY_CHANNEL: Record<PbrChannel, MaterialSlot | null> = {
  baseColor: 'map',
  normal: 'normalMap',
  roughness: 'roughnessMap',
  metalness: 'metalnessMap',
  ao: 'aoMap',
  height: 'displacementMap',
  emissive: 'emissiveMap',
  edge: null,
}

/** `null` for the cavity mask: three has no slot for it, and it is read in `onBeforeCompile`. */
export function slotFor(channel: PbrChannel): MaterialSlot | null {
  return SLOT_BY_CHANNEL[channel]
}

export type ChannelOrigin = 'generated' | 'derived' | 'imported'

const CHANNEL_ORIGINS: readonly ChannelOrigin[] = ['generated', 'derived', 'imported']

function isChannelOrigin(value: unknown): value is ChannelOrigin {
  return CHANNEL_ORIGINS.some(candidate => candidate === value)
}

/**
 * One channel of a texture. `origin` is what the strip badges, and what tells a derived channel
 * — recomputed whenever its source changes — from a generated one, which is frozen.
 *
 * What a derived channel was computed *from* is not stored: `sourceFor` answers it from the
 * graph, and a second copy in the file would be free to contradict it.
 */
export type ChannelMap = {
  assetId: string
  origin: ChannelOrigin
  /** On a generated channel, the model that answered. */
  modelId?: string
  width: number
  height: number
  /** Set when the pixels read the other way round — a smoothness map stored as roughness. */
  inverted?: true
}

export type ChannelSet = { [C in PbrChannel]?: ChannelMap }

/** One source per channel: two would leave "recompute what depends on this" with no answer. */
const SOURCE_BY_CHANNEL: Record<PbrChannel, PbrChannel | null> = {
  baseColor: null,
  normal: 'height',
  roughness: 'baseColor',
  metalness: null,
  ao: 'height',
  height: 'baseColor',
  emissive: null,
  edge: null,
}

/** The channel this one is computed from, or `null` when nothing computes it. */
export function sourceFor(channel: PbrChannel): PbrChannel | null {
  return SOURCE_BY_CHANNEL[channel]
}

export type ValueRange = { min: number; max: number }

export type Vector2 = { x: number; y: number }

/**
 * The settings of the preview material. None of them ever touch the pixels of a channel: they
 * are read at render time, which is what lets a value be changed back six months later.
 *
 * `roughnessRange` and `metalnessRange` remap what their map holds — the double handle of the
 * material panel — and are the identity by default.
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

/** The shapes a texture is judged on. A plane reads tiling, a sphere reads lighting. */
export type PreviewShape = 'sphere' | 'box' | 'cylinder' | 'plane' | 'torusKnot'

export const PREVIEW_SHAPES: readonly PreviewShape[] = [
  'sphere',
  'box',
  'cylinder',
  'plane',
  'torusKnot',
]

function isPreviewShape(value: unknown): value is PreviewShape {
  return PREVIEW_SHAPES.some(candidate => candidate === value)
}

/** How many times the map repeats on the preview. Local to the view, never baked into tiling. */
export type TilingPreview = 1 | 2 | 4

const TILING_PREVIEWS: readonly TilingPreview[] = [1, 2, 4]

function isTilingPreview(value: unknown): value is TilingPreview {
  return TILING_PREVIEWS.some(candidate => candidate === value)
}

export type PreviewSettings = {
  shape: PreviewShape
  /** What lights the preview — the same thing a 3D scene is lit by. */
  environment: EnvironmentRef
  envIntensity: number
  /** Radians, around the vertical axis. */
  envRotation: number
  /** Whether the environment is drawn behind the subject, or only lights it. */
  showBackground: boolean
  autoSpin: boolean
  tilingPreview: TilingPreview
}

/** Frozen for the same reason as the material defaults, `environment` being its nested object. */
export const DEFAULT_PREVIEW: PreviewSettings = {
  shape: 'sphere',
  environment: Object.freeze({ kind: 'studio' }),
  envIntensity: 1,
  envRotation: 0,
  showBackground: true,
  autoSpin: false,
  tilingPreview: 1,
}

Object.freeze(DEFAULT_PREVIEW)

/** What a `.tex` holds. */
export type TextureState = {
  channels: ChannelSet
  material: MaterialSettings
  preview: PreviewSettings
}

const DEFAULT_TEXTURE: TextureState = {
  channels: {},
  material: DEFAULT_TEXTURE_MATERIAL,
  preview: DEFAULT_PREVIEW,
}

/**
 * A texture with nothing in it yet — a copy, never the defaults themselves. The defaults are
 * shared by every document ever opened, and handed out by reference the first slider drag would
 * rewrite what all the others reset to.
 */
export function newTexture(): TextureState {
  return structuredClone(DEFAULT_TEXTURE)
}

export function resetMaterial(texture: TextureState): TextureState {
  return { ...texture, material: structuredClone(DEFAULT_TEXTURE_MATERIAL) }
}

/** Whether the pixels a channel would be computed from are there. */
export function canDerive(texture: TextureState, channel: PbrChannel): boolean {
  const from = sourceFor(channel)
  return from !== null && texture.channels[from] !== undefined
}

/** The empty channels, in the order the strip shows them. */
export function missingChannels(texture: TextureState): PbrChannel[] {
  return PBR_CHANNELS.filter(channel => texture.channels[channel] === undefined)
}

/**
 * Read like every other value, then held inside what the value means. A hand-edited `.tex` is
 * user territory, and a roughness of -1 reaches the GGX term as a negative alpha: black or white
 * pixels depending on the driver, with nothing on the way to say where it came from.
 */
function readUnit(source: Record<string, unknown>, key: string, fallback: number): number {
  return clamp(readNumber(source, key, fallback), 0, 1)
}

/** Kept in order as well as in range: handles crossed over would remap everything to nothing. */
function readRange(source: Record<string, unknown>, key: string, fallback: ValueRange): ValueRange {
  const raw = source[key]
  if (!isRecord(raw)) return { ...fallback }

  const min = readUnit(raw, 'min', fallback.min)
  return { min, max: clamp(readNumber(raw, 'max', fallback.max), min, 1) }
}

function readVector(source: Record<string, unknown>, key: string, fallback: Vector2): Vector2 {
  const raw = source[key]
  if (!isRecord(raw)) return { ...fallback }
  return { x: readNumber(raw, 'x', fallback.x), y: readNumber(raw, 'y', fallback.y) }
}

function readChannels(value: unknown): ChannelSet {
  const channels: ChannelSet = {}
  if (!isRecord(value)) return channels

  // Walked over the declared channels rather than over the file: a channel a hand edit invented
  // disappears with no case of its own, and the work is bounded by the domain either way.
  for (const channel of PBR_CHANNELS) {
    const entry = value[channel]
    // A channel with no asset behind it has no pixels: kept, it would show a tile claiming to
    // hold a map.
    if (!isRecord(entry) || typeof entry.assetId !== 'string' || entry.assetId.length === 0) {
      continue
    }

    const stored = isChannelOrigin(entry.origin) ? entry.origin : 'imported'
    // A channel nothing derives cannot hold derived pixels: badged that way it would promise a
    // recompute that no source can ever trigger.
    const derivable = sourceFor(channel) !== null

    const map: ChannelMap = {
      assetId: entry.assetId,
      origin: stored === 'derived' && !derivable ? 'imported' : stored,
      width: readPositive(entry, 'width', 0),
      height: readPositive(entry, 'height', 0),
    }

    if (typeof entry.modelId === 'string') map.modelId = entry.modelId
    if (entry.inverted === true) map.inverted = true

    channels[channel] = map
  }

  return channels
}

function readMaterial(value: unknown): MaterialSettings {
  const fallback = DEFAULT_TEXTURE_MATERIAL
  if (!isRecord(value)) return structuredClone(fallback)

  return {
    color: readString(value, 'color', fallback.color),
    roughness: readUnit(value, 'roughness', fallback.roughness),
    metalness: readUnit(value, 'metalness', fallback.metalness),
    roughnessRange: readRange(value, 'roughnessRange', fallback.roughnessRange),
    metalnessRange: readRange(value, 'metalnessRange', fallback.metalnessRange),
    // Signed on purpose: a negative scale flips the relief, which is a legitimate answer to a
    // normal map baked the other way round.
    normalScale: readNumber(value, 'normalScale', fallback.normalScale),
    invertNormalGreen: readBoolean(value, 'invertNormalGreen', fallback.invertNormalGreen),
    heightScale: readNumber(value, 'heightScale', fallback.heightScale),
    aoIntensity: readUnit(value, 'aoIntensity', fallback.aoIntensity),
    edgeIntensity: readUnit(value, 'edgeIntensity', fallback.edgeIntensity),
    emissive: readString(value, 'emissive', fallback.emissive),
    emissiveIntensity: readPositive(value, 'emissiveIntensity', fallback.emissiveIntensity),
    tiling: readVector(value, 'tiling', fallback.tiling),
    offset: readVector(value, 'offset', fallback.offset),
    rotation: readNumber(value, 'rotation', fallback.rotation),
  }
}

function readPreview(value: unknown): PreviewSettings {
  const fallback = DEFAULT_PREVIEW
  if (!isRecord(value)) return structuredClone(fallback)

  return {
    shape: isPreviewShape(value.shape) ? value.shape : fallback.shape,
    environment: readEnvironment(value.environment),
    envIntensity: readPositive(value, 'envIntensity', fallback.envIntensity),
    envRotation: readNumber(value, 'envRotation', fallback.envRotation),
    showBackground: readBoolean(value, 'showBackground', fallback.showBackground),
    autoSpin: readBoolean(value, 'autoSpin', fallback.autoSpin),
    tilingPreview: isTilingPreview(value.tilingPreview)
      ? value.tilingPreview
      : fallback.tilingPreview,
  }
}

/**
 * The content of a `.tex`, read back. It takes what the file layer already handed over — a
 * truncated file never reaches here, `main/project/documents.ts` refuses the envelope first —
 * so there is no `JSON.parse` to guard, only a value of any shape at all.
 *
 * Total, like the other spaces deserialize: a texture written before a setting existed opens on
 * that setting's default, and content that reads as nothing opens blank rather than throwing on
 * the way to the screen.
 */
export function parseTexture(content: unknown): TextureState {
  if (!isRecord(content)) return newTexture()

  return {
    channels: readChannels(content.channels),
    material: readMaterial(content.material),
    preview: readPreview(content.preview),
  }
}
