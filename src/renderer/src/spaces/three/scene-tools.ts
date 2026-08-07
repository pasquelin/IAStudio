import {
  mdiArrowAll,
  mdiAxisArrow,
  mdiCropFree,
  mdiCursorDefaultOutline,
  mdiDelete,
  mdiPlus,
  mdiResize,
} from '@mdi/js'
import type { CommandId } from '@shared/domain/shortcut'
import type { ToolbarItem, ToolMode } from '@/design/Toolbar'
import { LIGHT_TYPES } from '@/engines/scene/light-types'
import { MESH_PRIMITIVES } from '@/engines/scene/mesh-primitives'

/** `command` is absent on a group that only offers modes: `add` acts through its rows. */
export type SceneTool = ToolbarItem & { command?: CommandId }

/**
 * Everything a scene can hold, meshes then lights, from the two registries and nowhere else.
 * An entry the registry cannot build yet stays greyed rather than hidden.
 */
const ADD_MODES: readonly ToolMode[] = [
  ...MESH_PRIMITIVES.map(primitive => ({
    id: primitive.kind,
    labelKey: primitive.labelKey,
    icon: primitive.icon,
    disabled: primitive.disabled,
  })),
  ...LIGHT_TYPES.map(light => ({
    id: light.kind,
    labelKey: light.labelKey,
    icon: light.icon,
  })),
]

/**
 * The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here.
 *
 * Read in three groups: what manipulates, what frames, what creates and destroys. The three
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
    id: 'delete',
    command: 'scene.delete',
    labelKey: 'sceneTools.delete',
    descriptionKey: 'sceneTools.deleteHint',
    icon: mdiDelete,
  },
]
