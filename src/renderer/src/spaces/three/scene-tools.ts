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
import { ADD_ENTRIES } from '@/engines/scene/node-kinds'

/** `command` is absent on a group that only offers modes: `add` acts through its rows. */
export type SceneTool = ToolbarItem & { command?: CommandId }

/** Everything a scene can hold, from the registries and nowhere else. */
const ADD_MODES: readonly ToolMode[] = ADD_ENTRIES.map(({ entry, labelKey }) => ({
  id: entry.kind,
  labelKey,
  icon: entry.icon,
  disabled: entry.disabled,
}))

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
