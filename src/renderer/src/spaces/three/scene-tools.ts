import type { CommandId } from '@shared/domain/command'
import {
  mdiAngleAcute,
  mdiArrowAll,
  mdiArrowDown,
  mdiArrowDownBold,
  mdiArrowLeft,
  mdiArrowRight,
  mdiArrowUp,
  mdiArrowUpBold,
  mdiAxisArrow,
  mdiAxisArrowLock,
  mdiContentCopy,
  mdiContentCut,
  mdiContentDuplicate,
  mdiContentPaste,
  mdiCropFree,
  mdiCubeOutline,
  mdiCubeUnfolded,
  mdiCursorDefaultOutline,
  mdiDelete,
  mdiFolderPlusOutline,
  mdiBone,
  mdiHexagonOutline,
  mdiMagnet,
  mdiPlus,
  mdiResize,
  mdiVectorSquare,
} from '@mdi/js'
import type { ToolbarItem, ToolMode } from '@/design/Toolbar'
import { ADD_ENTRIES } from '@/engines/scene/node-kinds'
import {
  DISPLAY_MODES,
  VIEW_DIRECTIONS,
  type DisplayMode,
  type ViewDirection,
} from '@/engines/scene/scene-view'

/** Arrows read as the direction the camera looks from, which is what the row promises. */
const VIEW_ICONS: Record<ViewDirection, string> = {
  front: mdiArrowDown,
  back: mdiArrowUp,
  left: mdiArrowRight,
  right: mdiArrowLeft,
  top: mdiArrowDownBold,
  bottom: mdiArrowUpBold,
}

const DISPLAY_ICONS: Record<DisplayMode, string> = {
  shaded: mdiHexagonOutline,
  wireframe: mdiVectorSquare,
  both: mdiCubeUnfolded,
}

/** `command` is absent on a group that only offers modes: `add` acts through its rows. */
export type SceneTool = ToolbarItem & { command?: CommandId }

/** Everything a scene can hold, from the registries and nowhere else. */
const ADD_MODES: readonly ToolMode[] = ADD_ENTRIES.map(({ entry, labelKey }) => ({
  id: entry.kind,
  labelKey,
  icon: entry.icon,
  disabled: entry.disabled,
}))

/** The six sides, and the three ways of drawing what they show. */
const VIEW_MODES: readonly ToolMode[] = VIEW_DIRECTIONS.map(direction => ({
  id: direction,
  labelKey: `sceneViews.${direction}`,
  icon: VIEW_ICONS[direction],
}))

const DISPLAY_TOOL_MODES: readonly ToolMode[] = DISPLAY_MODES.map(mode => ({
  id: mode,
  labelKey: `sceneDisplay.${mode}`,
  icon: DISPLAY_ICONS[mode],
}))

/**
 * The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here.
 *
 * Read in four groups: what manipulates, what qualifies it, what frames, what creates and
 * destroys. The three
 * transform modes stay three visible buttons rather than one flyout — unlike the image space,
 * and on purpose: a mode is switched several times a minute, and Blender, Maya, Unity and the
 * three.js editor all show them at once.
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
  // What the view does, not what the scene is: a projection, a side to look from, a way to draw.
  {
    id: 'projection',
    command: 'scene.projection',
    labelKey: 'sceneTools.projection',
    descriptionKey: 'sceneTools.projectionHint',
    icon: mdiAngleAcute,
    separatorBefore: true,
  },
  {
    id: 'view',
    labelKey: 'sceneTools.view',
    descriptionKey: 'sceneTools.viewHint',
    icon: mdiCubeOutline,
    modes: VIEW_MODES,
  },
  {
    id: 'display',
    command: 'scene.display',
    labelKey: 'sceneTools.display',
    descriptionKey: 'sceneTools.displayHint',
    icon: mdiHexagonOutline,
    modes: DISPLAY_TOOL_MODES,
  },
  {
    id: 'skeletons',
    command: 'scene.skeletons',
    labelKey: 'sceneTools.skeletons',
    descriptionKey: 'sceneTools.skeletonsHint',
    icon: mdiBone,
  },
  {
    id: 'frame',
    command: 'scene.frame',
    labelKey: 'sceneTools.frame',
    descriptionKey: 'sceneTools.frameHint',
    icon: mdiCropFree,
    separatorBefore: true,
  },
  {
    id: 'add',
    labelKey: 'sceneTools.add',
    descriptionKey: 'sceneTools.addHint',
    icon: mdiPlus,
    separatorBefore: true,
    modes: ADD_MODES,
  },
  {
    id: 'group',
    command: 'scene.group',
    labelKey: 'sceneTools.group',
    descriptionKey: 'sceneTools.groupHint',
    icon: mdiFolderPlusOutline,
  },
  // Shown rather than left to the keyboard: the native Edit menu carries Copy and Paste of its
  // own, which act on text, and nothing else would say the scene has its own.
  {
    id: 'duplicate',
    command: 'scene.duplicate',
    labelKey: 'sceneTools.duplicate',
    descriptionKey: 'sceneTools.duplicateHint',
    icon: mdiContentDuplicate,
    separatorBefore: true,
  },
  {
    id: 'copy',
    command: 'scene.copy',
    labelKey: 'sceneTools.copy',
    descriptionKey: 'sceneTools.copyHint',
    icon: mdiContentCopy,
  },
  {
    id: 'cut',
    command: 'scene.cut',
    labelKey: 'sceneTools.cut',
    descriptionKey: 'sceneTools.cutHint',
    icon: mdiContentCut,
  },
  {
    id: 'paste',
    command: 'scene.paste',
    labelKey: 'sceneTools.paste',
    descriptionKey: 'sceneTools.pasteHint',
    icon: mdiContentPaste,
  },
  {
    id: 'delete',
    command: 'scene.delete',
    labelKey: 'sceneTools.delete',
    descriptionKey: 'sceneTools.deleteHint',
    icon: mdiDelete,
  },
]
