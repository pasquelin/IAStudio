import {
  mdiAxisArrow,
  mdiBorderInside,
  mdiBoxShadow,
  mdiCircleHalfFull,
  mdiCropFree,
  mdiCropSquare,
  mdiCubeOutline,
  mdiCylinder,
  mdiFlipHorizontal,
  mdiGrain,
  mdiGrid,
  mdiGridLarge,
  mdiLightbulbOn,
  mdiMirrorVariant,
  mdiPalette,
  mdiPanoramaOutline,
  mdiRotate360,
  mdiSphere,
  mdiSquareOutline,
  mdiTerrain,
  mdiVectorCircleVariant,
} from '@mdi/js'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import type { ToolbarItem, ToolMode } from '@/design/Toolbar/tools'
import {
  PREVIEW_SHAPES,
  TILING_PREVIEWS,
  type PreviewShape,
  type PreviewSettings,
  type TilingPreview,
} from '@/engines/texture/textureState'

/** The subject a material is judged on, as a glyph. The button wears the one in use. */
const SHAPE_ICONS: Record<PreviewShape, string> = {
  sphere: mdiSphere,
  box: mdiCubeOutline,
  cylinder: mdiCylinder,
  plane: mdiSquareOutline,
  torusKnot: mdiVectorCircleVariant,
}

/** i18n key of a shape — one word, one place, which the inspector reads from here too. */
export const SHAPE_LABELS: Record<PreviewShape, string> = {
  sphere: 'texture.shapeSphere',
  box: 'texture.shapeBox',
  cylinder: 'texture.shapeCylinder',
  plane: 'texture.shapePlane',
  torusKnot: 'texture.shapeKnot',
}

const CHANNEL_ICONS: Record<PbrChannel, string> = {
  baseColor: mdiPalette,
  normal: mdiAxisArrow,
  roughness: mdiGrain,
  metalness: mdiMirrorVariant,
  ao: mdiBoxShadow,
  height: mdiTerrain,
  emissive: mdiLightbulbOn,
  edge: mdiBorderInside,
}

/** How many times the map is shown repeated. The glyph gets busier as the count does. */
const TILING_ICONS: Record<TilingPreview, string> = {
  1: mdiCropSquare,
  2: mdiGridLarge,
  4: mdiGrid,
}

/**
 * One key per count rather than one key holding `{{count}}`: a row's label is read through
 * `t(labelKey)` with no values, and the interpolated one reached the screen as its own hole.
 */
const TILING_LABELS: Record<TilingPreview, string> = {
  1: 'texture.tilingOnce',
  2: 'texture.tilingTwice',
  4: 'texture.tilingFourfold',
}

/** The row that gives the lit material back, and the id no channel can take. */
export const MATERIAL_MODE = 'material'

/**
 * What the bar reads to draw itself. `filled` is offered greyed rather than hidden, so the bar
 * says what a texture CAN hold and not only what this one does.
 */
export type TextureToolsInput = {
  preview: Pick<
    PreviewSettings,
    'shape' | 'tilingPreview' | 'showSeam' | 'showBackground' | 'autoSpin'
  >
  inspected: PbrChannel | null
  filled: readonly PbrChannel[]
}

const shapeModes = (): readonly ToolMode[] =>
  PREVIEW_SHAPES.map(shape => ({
    id: shape,
    labelKey: SHAPE_LABELS[shape],
    descriptionKey: 'texture.previewShapeHint',
    icon: SHAPE_ICONS[shape],
  }))

const channelModes = (filled: readonly PbrChannel[]): readonly ToolMode[] => [
  {
    id: MATERIAL_MODE,
    labelKey: 'texture.litMaterial',
    descriptionKey: 'texture.litMaterialHint',
    icon: mdiCircleHalfFull,
  },
  ...PBR_CHANNELS.map(channel => ({
    id: channel,
    labelKey: `texture.channel.${channel}`,
    descriptionKey: 'texture.inspectChannelHint',
    icon: CHANNEL_ICONS[channel],
    // A channel with no picture has nothing to show flat, and inspecting it left the viewport
    // black with no way of telling that from a map of black pixels.
    disabled: !filled.includes(channel),
  })),
]

const tilingModes = (): readonly ToolMode[] =>
  TILING_PREVIEWS.map(times => ({
    id: String(times),
    labelKey: TILING_LABELS[times],
    descriptionKey: 'texture.tilingPreviewHint',
    icon: TILING_ICONS[times],
  }))

/**
 * The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here.
 *
 * Built from the state, unlike the four other spaces: each group wears the choice it is on, so
 * the shape in use is legible without opening anything. Nothing here is a `CommandId`.
 */
export function textureTools({ preview, inspected, filled }: TextureToolsInput): ToolbarItem[] {
  return [
    {
      id: 'shape',
      labelKey: 'texture.support',
      descriptionKey: 'texture.supportHint',
      icon: SHAPE_ICONS[preview.shape],
      modes: shapeModes(),
      activeMode: preview.shape,
    },
    {
      id: 'channel',
      labelKey: 'texture.inspect',
      descriptionKey: 'texture.inspectHint',
      icon: inspected ? CHANNEL_ICONS[inspected] : mdiCircleHalfFull,
      separatorBefore: true,
      modes: channelModes(filled),
      activeMode: inspected ?? MATERIAL_MODE,
    },
    {
      id: 'tiling',
      labelKey: 'texture.tilingPreview',
      descriptionKey: 'texture.tilingPreviewHint',
      icon: TILING_ICONS[preview.tilingPreview],
      separatorBefore: true,
      modes: tilingModes(),
      activeMode: String(preview.tilingPreview),
    },
    {
      id: 'seam',
      labelKey: 'texture.showSeam',
      descriptionKey: 'texture.showSeamHint',
      icon: mdiFlipHorizontal,
      pressed: preview.showSeam,
    },
    {
      id: 'background',
      labelKey: 'texture.showBackground',
      descriptionKey: 'texture.showBackgroundHint',
      icon: mdiPanoramaOutline,
      separatorBefore: true,
      pressed: preview.showBackground,
    },
    {
      id: 'spin',
      labelKey: 'texture.autoSpin',
      descriptionKey: 'texture.autoSpinHint',
      icon: mdiRotate360,
      pressed: preview.autoSpin,
    },
    {
      id: 'frame',
      labelKey: 'texture.frame',
      descriptionKey: 'texture.frameHint',
      icon: mdiCropFree,
      separatorBefore: true,
    },
  ]
}

/** The bar hands back a plain string; this is where a shape row becomes one of ours again. */
export function shapeFrom(modeId: string): PreviewShape | null {
  return PREVIEW_SHAPES.find(shape => shape === modeId) ?? null
}

/** `null` for the row that gives the lit material back, which is not a channel. */
export function channelFrom(modeId: string): PbrChannel | null {
  return PBR_CHANNELS.find(channel => channel === modeId) ?? null
}

export function tilingFrom(modeId: string): TilingPreview | null {
  return TILING_PREVIEWS.find(times => String(times) === modeId) ?? null
}

/**
 * What clicking the button itself does, for the three groups that hold a choice: it steps to the
 * next entry, where hovering shows them all. The same relation `Z` has to the 3D display menu —
 * a menu is where one is picked, a click is how one moves through them.
 */
export function nextIn<T>(values: readonly T[], current: T): T {
  const at = values.indexOf(current)
  const next = values[(at + 1) % values.length]
  // `=== undefined` rather than `??`: the channel cycle holds `null` for the lit material, and a
  // nullish fallback swallowed it — the last channel stepped to itself instead of coming back.
  return next === undefined ? current : next
}

/** The next channel with something in it, the lit material included — never a greyed row. */
export function nextInspected(
  filled: readonly PbrChannel[],
  inspected: PbrChannel | null,
): PbrChannel | null {
  // Ordered as the registry is, not as the document filled them: a cycle whose order depends on
  // what was dropped first moves under the hand between two textures.
  const offered = [null, ...PBR_CHANNELS.filter(channel => filled.includes(channel))]
  return nextIn(offered, offered.includes(inspected) ? inspected : null)
}
