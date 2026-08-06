import { mdiBrush, mdiCrop, mdiEraser, mdiFormatText, mdiSelection } from '@mdi/js'
import type { Tool } from '@/design/Toolbar'

/**
 * Declared, visible, and inert: the canvas engine does not exist yet. A visible-but-disabled
 * bar says honestly where the software stands; an absent one suggests there will never be one.
 */
export const IMAGE_TOOLS: readonly Tool[] = [
  { id: 'brush', labelKey: 'imageTools.brush', icon: mdiBrush, disabled: true },
  { id: 'eraser', labelKey: 'imageTools.eraser', icon: mdiEraser, disabled: true },
  { id: 'select', labelKey: 'imageTools.select', icon: mdiSelection, disabled: true },
  { id: 'crop', labelKey: 'imageTools.crop', icon: mdiCrop, disabled: true },
  { id: 'text', labelKey: 'imageTools.text', icon: mdiFormatText, disabled: true },
]
