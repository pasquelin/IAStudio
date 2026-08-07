import { mdiCursorDefault, mdiHandBackRight, mdiKnife } from '@mdi/js'
import type { ToolbarItem } from '@/design/Toolbar'

/** The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here. */
export const VIDEO_TOOLS: readonly ToolbarItem[] = [
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

export const DEFAULT_VIDEO_TOOL = 'select'
