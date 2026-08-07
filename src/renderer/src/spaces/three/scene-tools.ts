import { mdiArrowAll, mdiAxisArrow, mdiCropFree, mdiDelete, mdiResize } from '@mdi/js'
import type { CommandId } from '@shared/domain/shortcut'
import type { ToolbarItem } from '@/design/Toolbar'

export type SceneTool = ToolbarItem & { command: CommandId }

/** The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here. */
export const SCENE_TOOLS: readonly SceneTool[] = [
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
  },
  {
    id: 'delete',
    command: 'scene.delete',
    labelKey: 'sceneTools.delete',
    descriptionKey: 'sceneTools.deleteHint',
    icon: mdiDelete,
  },
]
