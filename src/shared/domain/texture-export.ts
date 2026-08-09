/**
 * Where a texture goes when it leaves the studio.
 *
 * Every engine wants the same eight channels arranged differently — its own file names, its own
 * packing, its own idea of which way a normal's green points. All of that is data here rather
 * than code in the renderer: the recipes are what a test can read, and the main process, which
 * writes the files, has to type what it writes.
 *
 * In `shared/` for the second reason. It holds no three.js and no `fs`.
 */
import { PBR_CHANNELS, type PbrChannel } from './texture'

/** The engines a texture can be handed to, plus the one that hands over nothing but pixels. */
export type TextureExportTarget = 'gltf' | 'unity' | 'unreal' | 'roblox' | 'raw'

export const TEXTURE_EXPORT_TARGETS: readonly TextureExportTarget[] = [
  'gltf',
  'unity',
  'unreal',
  'roblox',
  'raw',
]

export function isTextureExportTarget(value: unknown): value is TextureExportTarget {
  return TEXTURE_EXPORT_TARGETS.some(candidate => candidate === value)
}

/**
 * What becomes of the pictures a target resolves. Every target packs the same way; they differ
 * in where the result lands — beside each other in a folder, or embedded in one `.glb`.
 */
export type TargetKind = 'pictures' | 'gltf'

export function kindOf(target: TextureExportTarget): TargetKind {
  return target === 'gltf' ? 'gltf' : 'pictures'
}

/** Which of a channel's own components is read. A grey map holds its value on all three. */
export type PackComponent = 'r' | 'g' | 'b'

/**
 * One component of an exported picture, read off one channel.
 *
 * `missing` is what lands in the file when the texture has no such channel — expressed as what
 * is **written**, not as what would be read before inverting. An export of a texture with no
 * occlusion has to hold "not occluded" in the slot an engine will read as occlusion, and a
 * recipe that had to reason backwards through its own `invert` would get that wrong once.
 */
export type PackSource = {
  channel: PbrChannel
  from: PackComponent
  /** Written as `1 - v`: a roughness an engine wants as smoothness, and back. */
  invert?: true
  missing: number
}

/**
 * One picture an export writes: four components, each read off a channel or held at a constant.
 *
 * Four rather than a list, because a picture is exactly RGBA and a list would allow five.
 */
export type ExportPicture = {
  /** Appended to the texture's name — `<name>_BaseColor.png`. */
  suffix: string
  red: PackSource | number
  green: PackSource | number
  blue: PackSource | number
  alpha: PackSource | number
  /**
   * The slot of the material this picture fills, where the target builds one. Only `gltf` does:
   * the four that write a folder hand the file names over and let the engine's importer decide.
   *
   * Named rather than matched on the suffix, so the builder and the recipe cannot drift apart
   * over a rename nothing else would notice.
   */
  role?: MaterialRole
}

/** A slot of a glTF material. `orm` fills the occlusion and metallic-roughness slots at once. */
export type MaterialRole = 'baseColor' | 'normal' | 'orm' | 'emissive'

/** A channel copied as it stands: three components off its own, opaque. */
function copy(channel: PbrChannel, suffix: string): ExportPicture {
  return {
    suffix,
    red: { channel, from: 'r', missing: 0 },
    green: { channel, from: 'g', missing: 0 },
    blue: { channel, from: 'b', missing: 0 },
    alpha: 1,
  }
}

/**
 * A grey channel copied onto all three components. Written on three rather than on red alone
 * because a viewer opening the file reads a grey picture, and an engine sampling `.g` — Unity's
 * occlusion slot does — reads the value rather than nothing.
 */
function grey(channel: PbrChannel, suffix: string, missing: number): ExportPicture {
  const source: PackSource = { channel, from: 'r', missing }
  return { suffix, red: source, green: source, blue: source, alpha: 1 }
}

/**
 * The normal with its green channel flipped — the DirectX convention, which is what Unreal
 * expects on import. Everything the studio derives is OpenGL: `derive-shaders` writes `+y` for
 * green, and `invertNormalGreen` is what answers a map that arrived the other way round.
 */
function flippedNormal(suffix: string): ExportPicture {
  return {
    suffix,
    red: { channel: 'normal', from: 'r', missing: 0.5 },
    green: { channel: 'normal', from: 'g', invert: true, missing: 0.5 },
    blue: { channel: 'normal', from: 'b', missing: 1 },
    alpha: 1,
  }
}

/**
 * Unity, URP Lit. One packed picture rather than three: URP reads metallic on red, occlusion on
 * green and smoothness on alpha, so the same file is assigned to both the metallic and the
 * occlusion slot. Blue is left at zero — URP reads nothing there.
 *
 * Smoothness, not roughness: Unity's slot is the inverse of the studio's channel.
 */
const UNITY: readonly ExportPicture[] = [
  copy('baseColor', '_BaseMap'),
  copy('normal', '_BumpMap'),
  {
    suffix: '_MaskMap',
    red: { channel: 'metalness', from: 'r', missing: 0 },
    green: { channel: 'ao', from: 'r', missing: 1 },
    blue: 0,
    // Absent, a texture is fully rough, which is a smoothness of zero.
    alpha: { channel: 'roughness', from: 'r', invert: true, missing: 0 },
  },
  copy('emissive', '_EmissionMap'),
  grey('height', '_ParallaxMap', 0),
]

/**
 * Unreal. ORM is the packing the engine's own starter content uses — occlusion on red,
 * roughness on green, metallic on blue — and the normal is DirectX.
 */
const UNREAL: readonly ExportPicture[] = [
  copy('baseColor', '_BaseColor'),
  flippedNormal('_Normal'),
  {
    suffix: '_ORM',
    red: { channel: 'ao', from: 'r', missing: 1 },
    green: { channel: 'roughness', from: 'r', missing: 1 },
    blue: { channel: 'metalness', from: 'r', missing: 0 },
    alpha: 1,
  },
  copy('emissive', '_Emissive'),
  grey('height', '_Height', 0),
]

/**
 * Roblox `SurfaceAppearance`, which takes exactly four maps and no packing. Its normal is read
 * as x, y, z on r, g, b — the OpenGL convention the studio already writes.
 */
const ROBLOX: readonly ExportPicture[] = [
  copy('baseColor', '_ColorMap'),
  copy('normal', '_NormalMap'),
  grey('roughness', '_RoughnessMap', 1),
  grey('metalness', '_MetalnessMap', 0),
]

/** The suffix each channel goes out under when nothing is packed. */
const RAW_SUFFIXES: Record<PbrChannel, string> = {
  baseColor: '_BaseColor',
  normal: '_Normal',
  roughness: '_Roughness',
  metalness: '_Metalness',
  ao: '_AO',
  height: '_Height',
  emissive: '_Emissive',
  edge: '_Edge',
}

/**
 * The channels as they stand, one file each — including the cavity mask, which no engine has a
 * slot for and which is the reason this target exists beside the four that do.
 *
 * "As they stand" is not "as stored": a roughness held as smoothness goes out as roughness,
 * because the file is named for what it holds. `resolvePicture` is where the two meet.
 */
const RAW: readonly ExportPicture[] = PBR_CHANNELS.map(channel =>
  channel === 'baseColor' || channel === 'normal' || channel === 'emissive'
    ? copy(channel, RAW_SUFFIXES[channel])
    : grey(channel, RAW_SUFFIXES[channel], 0),
)

/**
 * glTF, whose metallic-roughness texture holds roughness on green and metallic on blue, and
 * whose occlusion texture is read on red. The same three components as Unreal's ORM, which is
 * where that packing comes from — so one picture fills both slots, and the recipe is shared
 * rather than written twice.
 *
 * No height: glTF has no displacement slot outside an extension, and a map an importer ignores
 * is weight in a file nobody asked to carry. The normal stays OpenGL, which the format states.
 */
const GLTF: readonly ExportPicture[] = [
  { ...copy('baseColor', '_BaseColor'), role: 'baseColor' },
  { ...copy('normal', '_Normal'), role: 'normal' },
  {
    suffix: '_ORM',
    red: { channel: 'ao', from: 'r', missing: 1 },
    green: { channel: 'roughness', from: 'r', missing: 1 },
    blue: { channel: 'metalness', from: 'r', missing: 0 },
    alpha: 1,
    role: 'orm',
  },
  { ...copy('emissive', '_Emissive'), role: 'emissive' },
]

const PICTURES_BY_TARGET: Record<TextureExportTarget, readonly ExportPicture[]> = {
  gltf: GLTF,
  unity: UNITY,
  unreal: UNREAL,
  roblox: ROBLOX,
  raw: RAW,
}

/**
 * The longest side a target accepts, where it has one. Roblox refuses a map above 1024, so an
 * export at full resolution would be an export it rejects — the one place where "export at full
 * resolution" is not the studio's call to make.
 */
const MAX_SIZE_BY_TARGET: Partial<Record<TextureExportTarget, number>> = {
  roblox: 1024,
}

export function maxSizeOf(target: TextureExportTarget): number | null {
  return MAX_SIZE_BY_TARGET[target] ?? null
}

/**
 * Held under the target's ceiling, keeping the aspect ratio. Not squared, even where the target
 * asks for square: a texture stretched on the way out is a texture that no longer matches the
 * uv it was authored against.
 */
export function boundedSize(
  size: { width: number; height: number },
  max: number | null,
): { width: number; height: number } {
  const longest = Math.max(size.width, size.height)
  if (max === null || longest <= max) return { ...size }

  const scale = max / longest
  // Floored then held at one: a 4096×1 channel would otherwise round its short side to zero,
  // and a frame of no height draws nothing at all.
  return {
    width: Math.max(1, Math.floor(size.width * scale)),
    height: Math.max(1, Math.floor(size.height * scale)),
  }
}

/** What a component ends up being, once the texture's own channels have answered. */
export type ResolvedComponent =
  { assetId: string; from: PackComponent; invert: boolean } | { constant: number }

/** One picture, ready to draw: its file name, and where each of its four components reads. */
export type ResolvedPicture = {
  /** Without extension — the writer decides that, as it does for a scene. */
  name: string
  red: ResolvedComponent
  green: ResolvedComponent
  blue: ResolvedComponent
  alpha: ResolvedComponent
  role?: MaterialRole
}

/** What `resolvePictures` needs to know about a channel, and nothing more. */
export type ExportChannel = {
  assetId: string
  /** The pixels read the other way round — a smoothness map stored as roughness. */
  inverted?: true
  /**
   * The normal arrived in the DirectX convention, which is what `invertNormalGreen` says of it.
   *
   * It belongs here rather than staying a render setting: a target asks for a convention, the
   * channel already has one, and the export is the one place the two have to be reconciled.
   * Read on green alone — the other two components mean the same thing either way round.
   */
  greenFlipped?: true
}

export type ExportChannels = { [C in PbrChannel]?: ExportChannel }

function resolveComponent(
  component: PackSource | number,
  channels: ExportChannels,
): ResolvedComponent {
  if (typeof component === 'number') return { constant: component }

  const channel = channels[component.channel]
  if (!channel) return { constant: component.missing }

  // Counted rather than chained: three negations can meet on one component — the recipe's, the
  // channel's own, and a normal that arrived flipped — and an odd number of them is one flip.
  // Two that both fired would have written a smoothness map into a slot named roughness, or
  // handed Unreal the OpenGL green it already had, with nothing downstream to say so.
  const flips =
    (component.invert === true ? 1 : 0) +
    (channel.inverted === true ? 1 : 0) +
    (channel.greenFlipped === true && component.from === 'g' ? 1 : 0)

  return { assetId: channel.assetId, from: component.from, invert: flips % 2 === 1 }
}

function readsSomething(picture: ResolvedPicture): boolean {
  return [picture.red, picture.green, picture.blue, picture.alpha].some(
    component => !('constant' in component),
  )
}

/**
 * The files an export writes, in order.
 *
 * A picture whose every component fell back to a constant is dropped: a texture with no
 * occlusion and no metalness would otherwise ship a flat grey `_ORM` that says nothing, and the
 * whole point of the ORM slot is that what is in it was measured.
 */
export function resolvePictures(
  target: TextureExportTarget,
  channels: ExportChannels,
  name: string,
): ResolvedPicture[] {
  return PICTURES_BY_TARGET[target]
    .map(picture => ({
      name: `${name}${picture.suffix}`,
      red: resolveComponent(picture.red, channels),
      green: resolveComponent(picture.green, channels),
      blue: resolveComponent(picture.blue, channels),
      alpha: resolveComponent(picture.alpha, channels),
      ...(picture.role ? { role: picture.role } : {}),
    }))
    .filter(readsSomething)
}

/** The assets one picture reads, each once. What the port has to decode before it can draw. */
export function assetsOf(picture: ResolvedPicture): string[] {
  const seen: string[] = []
  for (const component of [picture.red, picture.green, picture.blue, picture.alpha]) {
    if (!('constant' in component) && !seen.includes(component.assetId)) {
      seen.push(component.assetId)
    }
  }
  return seen
}

/**
 * Everything a file name cannot hold, gone. A document is titled by hand — "Brique 1/2" is an
 * ordinary title and a path traversal at the same time — and the export names a folder after it.
 *
 * Falls back rather than throwing: a title made entirely of separators is a title, and refusing
 * to export it would be a dialog with nothing to say.
 */
export function safeFileName(name: string, fallback = 'texture'): string {
  const printable = [...name]
    // Control characters pass on Linux and are refused on Windows, so a name holding one would
    // export on the machine it was written on and nowhere else. Mapped by code point rather than
    // by a regex, which cannot hold this range without the linter being told to look away.
    .map(character => ((character.codePointAt(0) ?? 0) < 0x20 ? ' ' : character))
    .join('')

  const cleaned = printable
    .replace(/[/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    // Dots and spaces together, because the separators just became spaces: `..\..\etc` would
    // otherwise keep the second `..` and open on a folder named for a traversal that failed.
    .replace(/^[.\s]+/, '')
    .trim()

  // Trimmed again after the cut: 80 characters can land in the middle of a space run.
  return cleaned.length > 0 ? cleaned.slice(0, 80).trim() : fallback
}
