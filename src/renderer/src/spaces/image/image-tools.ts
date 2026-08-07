import {
  mdiBrush,
  mdiEraser,
  mdiEyedropperVariant,
  mdiHandBackRight,
  mdiSelectionDrag,
} from '@mdi/js'
import type { CanvasTool } from '@/engines/canvas/CanvasEngine'
import type { Tool } from '@/design/Toolbar'

export type ImageTool = Tool & { tool: CanvasTool }

/** Modes of the eraser, in the order the flyout shows them. */
export type EraserMode = 'point' | 'selection'

/**
 * The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here.
 *
 * The eraser carries two modes, so it opens a flyout; the others act on click. That rule comes
 * from map3D and lives in `useHoverFlyout`, not here.
 */
export const IMAGE_TOOLS: readonly ImageTool[] = [
  { id: 'brush', tool: 'brush', labelKey: 'imageTools.brush', icon: mdiBrush },
  {
    id: 'eraser',
    tool: 'eraser',
    labelKey: 'imageTools.eraser',
    icon: mdiEraser,
    modes: [
      { id: 'point', labelKey: 'imageTools.eraserPoint', icon: mdiEraser },
      { id: 'selection', labelKey: 'imageTools.eraserSelection', icon: mdiSelectionDrag },
    ],
  },
  { id: 'picker', tool: 'picker', labelKey: 'imageTools.picker', icon: mdiEyedropperVariant },
  { id: 'hand', tool: 'hand', labelKey: 'imageTools.hand', icon: mdiHandBackRight },
]

export function toolById(id: string): ImageTool | null {
  return IMAGE_TOOLS.find(tool => tool.id === id) ?? null
}
