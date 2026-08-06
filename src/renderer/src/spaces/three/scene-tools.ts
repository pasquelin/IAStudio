import { mdiArrowAll, mdiAxisArrow, mdiCropFree, mdiDelete, mdiResize } from '@mdi/js'
import type { CommandId } from '@shared/domain/shortcut'
import type { Tool } from '@/design/Toolbar'

export type SceneTool = Tool & { command: CommandId }

/** The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here. */
export const SCENE_TOOLS: readonly SceneTool[] = [
  {
    id: 'translate',
    command: 'scene.translate',
    labelKey: 'sceneTools.translate',
    icon: mdiArrowAll,
  },
  { id: 'rotate', command: 'scene.rotate', labelKey: 'sceneTools.rotate', icon: mdiAxisArrow },
  { id: 'scale', command: 'scene.scale', labelKey: 'sceneTools.scale', icon: mdiResize },
  { id: 'frame', command: 'scene.frame', labelKey: 'sceneTools.frame', icon: mdiCropFree },
  { id: 'delete', command: 'scene.delete', labelKey: 'sceneTools.delete', icon: mdiDelete },
]
