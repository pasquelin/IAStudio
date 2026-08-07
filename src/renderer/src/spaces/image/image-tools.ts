import {
  mdiBrush,
  mdiCursorMove,
  mdiEraser,
  mdiEyedropperVariant,
  mdiFormatColorFill,
  mdiHandBackRight,
  mdiLasso,
  mdiSelectDrag,
  mdiSelectionDrag,
} from '@mdi/js'
import type { CanvasTool } from '@/engines/canvas/CanvasEngine'
import type { Tool } from '@/design/Toolbar'

export type ImageTool = Tool & { tool: CanvasTool }

/**
 * The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here.
 *
 * Tools with two or more modes open a flyout on hover; the others act on click. That rule comes
 * from map3D and lives in `useHoverFlyout`, not here.
 *
 * `move` and `hand` are two different tools, as in Photoshop: one drags the content, the other
 * drags the view. Conflating them costs a gesture nobody can get back.
 */
export const IMAGE_TOOLS: readonly ImageTool[] = [
  {
    id: 'select',
    tool: 'select',
    labelKey: 'imageTools.select',
    icon: mdiSelectDrag,
    shortcut: 'M',
    modes: [
      { id: 'rectangle', labelKey: 'imageTools.selectRectangle', icon: mdiSelectionDrag },
      { id: 'lasso', labelKey: 'imageTools.selectLasso', icon: mdiLasso },
    ],
  },
  { id: 'move', tool: 'move', labelKey: 'imageTools.move', icon: mdiCursorMove, shortcut: 'V' },
  { id: 'brush', tool: 'brush', labelKey: 'imageTools.brush', icon: mdiBrush, shortcut: 'B' },
  {
    id: 'eraser',
    tool: 'eraser',
    labelKey: 'imageTools.eraser',
    icon: mdiEraser,
    shortcut: 'E',
    modes: [
      { id: 'point', labelKey: 'imageTools.eraserPoint', icon: mdiEraser },
      { id: 'selection', labelKey: 'imageTools.eraserSelection', icon: mdiSelectionDrag },
    ],
  },
  {
    id: 'fill',
    tool: 'fill',
    labelKey: 'imageTools.fill',
    icon: mdiFormatColorFill,
    shortcut: 'G',
  },
  {
    id: 'picker',
    tool: 'picker',
    labelKey: 'imageTools.picker',
    icon: mdiEyedropperVariant,
    shortcut: 'I',
  },
  { id: 'hand', tool: 'hand', labelKey: 'imageTools.hand', icon: mdiHandBackRight, shortcut: 'H' },
]

export function toolById(id: string): ImageTool | null {
  return IMAGE_TOOLS.find(tool => tool.id === id) ?? null
}

/** Tools whose settings the bar's form shows. The others have nothing to set yet. */
export function hasBrushSettings(id: string): boolean {
  return id === 'brush' || id === 'eraser'
}
