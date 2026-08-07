import { mdiCursorDefault, mdiHandBackRight, mdiKnife } from '@mdi/js'
import type { ToolbarItem } from '@/design/Toolbar'

export type VideoToolId = 'select' | 'blade' | 'hand'

export type VideoTool = ToolbarItem & { id: VideoToolId }

/** The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here. */
export const VIDEO_TOOLS: readonly VideoTool[] = [
  {
    id: 'select',
    labelKey: 'videoTools.select',
    descriptionKey: 'videoTools.selectHint',
    icon: mdiCursorDefault,
    shortcut: 'V',
  },
  {
    id: 'blade',
    labelKey: 'videoTools.blade',
    descriptionKey: 'videoTools.bladeHint',
    icon: mdiKnife,
    shortcut: 'C',
  },
  {
    id: 'hand',
    labelKey: 'videoTools.hand',
    descriptionKey: 'videoTools.handHint',
    icon: mdiHandBackRight,
    shortcut: 'H',
  },
]

export const DEFAULT_VIDEO_TOOL: VideoToolId = 'select'

/** The bar hands back a plain string; this is where it becomes one of ours again. */
export function isVideoTool(id: string): id is VideoToolId {
  return VIDEO_TOOLS.some(tool => tool.id === id)
}
