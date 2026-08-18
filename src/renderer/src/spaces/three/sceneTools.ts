import type { CommandId } from '@shared/domain/command'
import {
  mdiArrowAll,
  mdiArrowDown,
  mdiArrowDownBold,
  mdiArrowLeft,
  mdiArrowRight,
  mdiArrowUp,
  mdiArrowUpBold,
  mdiAxisArrow,
  mdiAxisArrowLock,
  mdiCircleHalfFull,
  mdiCircleOpacity,
  mdiCropFree,
  mdiCubeOutline,
  mdiCubeUnfolded,
  mdiCursorDefaultOutline,
  mdiHexagonOutline,
  mdiMagnet,
  mdiResize,
  mdiSphere,
  mdiThermometer,
  mdiVectorSquare,
} from '@mdi/js'
import type { ToolbarItem, ToolMode } from '@/design/Toolbar/tools'
import { DISPLAY_MODES, type DisplayMode, type ViewDirection } from '@shared/domain/scene'

/** Arrows read as the direction the camera looks from, which is what the row promises. */
const VIEW_ICONS: Record<ViewDirection, string> = {
  front: mdiArrowDown,
  back: mdiArrowUp,
  left: mdiArrowRight,
  right: mdiArrowLeft,
  top: mdiArrowDownBold,
  bottom: mdiArrowUpBold,
}

/** What a view of the quad layout wears in its own menu. The free one is the studio's cube. */
export const PANE_VIEW_ICONS: Record<'free' | ViewDirection, string> = {
  free: mdiCubeOutline,
  ...VIEW_ICONS,
}

const DISPLAY_ICONS: Record<DisplayMode, string> = {
  shaded: mdiHexagonOutline,
  wireframe: mdiVectorSquare,
  both: mdiCubeUnfolded,
  solid: mdiCircleOpacity,
  material: mdiSphere,
  matcap: mdiCircleHalfFull,
  density: mdiThermometer,
}

/** Every tool of this bar carries one now: the two groups that acted through rows have left. */
export type SceneTool = ToolbarItem & { command: CommandId }

const DISPLAY_TOOL_MODES: readonly ToolMode[] = DISPLAY_MODES.map(mode => ({
  id: mode,
  labelKey: `sceneDisplay.${mode}`,
  descriptionKey: `sceneDisplay.${mode}Hint`,
  icon: DISPLAY_ICONS[mode],
}))

/**
 * The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here.
 *
 * Eight buttons, down from twenty-three. What is left is what a hand reaches for WHILE
 * manipulating: the four transform modes, the two that qualify them, the one view setting a
 * modeller flips several times a minute, and framing the selection.
 *
 * The fifteen that left are all in the native menu now — Édition for what acts on a selection,
 * Affichage for what the viewport does, Ajouter for what a scene gains. They are settings and
 * one-off gestures, not moves repeated by the minute, and a bar of twenty-three icons made the
 * eight that matter impossible to find.
 *
 * The three transform modes stay three visible buttons rather than one flyout — unlike the image
 * space, and on purpose: a mode is switched several times a minute, and Blender, Maya, Unity and
 * the three.js editor all show them at once.
 */
export const SCENE_TOOLS: readonly SceneTool[] = [
  {
    id: 'select',
    command: 'scene.select',
    labelKey: 'sceneTools.select',
    descriptionKey: 'sceneTools.selectHint',
    icon: mdiCursorDefaultOutline,
  },
  {
    id: 'translate',
    command: 'scene.translate',
    labelKey: 'sceneTools.translate',
    descriptionKey: 'sceneTools.translateHint',
    icon: mdiArrowAll,
  },
  {
    id: 'rotate',
    command: 'scene.rotate',
    labelKey: 'sceneTools.rotate',
    descriptionKey: 'sceneTools.rotateHint',
    icon: mdiAxisArrow,
  },
  {
    id: 'scale',
    command: 'scene.scale',
    labelKey: 'sceneTools.scale',
    descriptionKey: 'sceneTools.scaleHint',
    icon: mdiResize,
  },
  // Toggles, not armed tools: neither replaces the transform mode, both qualify it.
  {
    id: 'snap',
    command: 'scene.snap',
    labelKey: 'sceneTools.snap',
    descriptionKey: 'sceneTools.snapHint',
    icon: mdiMagnet,
    separatorBefore: true,
  },
  {
    id: 'space',
    command: 'scene.space',
    labelKey: 'sceneTools.space',
    descriptionKey: 'sceneTools.spaceHint',
    icon: mdiAxisArrowLock,
  },
  // The one view setting worth a button: a modeller flips between shaded and wireframe several
  // times a minute, which is what tells it from the seven rows the native View menu now carries.
  {
    id: 'display',
    command: 'scene.display',
    labelKey: 'sceneTools.display',
    descriptionKey: 'sceneTools.displayHint',
    icon: mdiHexagonOutline,
    separatorBefore: true,
    modes: DISPLAY_TOOL_MODES,
  },
  {
    id: 'frame',
    command: 'scene.frame',
    labelKey: 'sceneTools.frame',
    descriptionKey: 'sceneTools.frameHint',
    icon: mdiCropFree,
    separatorBefore: true,
  },
]
