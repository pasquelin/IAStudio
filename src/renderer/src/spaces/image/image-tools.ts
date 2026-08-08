import {
  mdiArrowTopRight,
  mdiBrush,
  mdiCardOutline,
  mdiCircleOutline,
  mdiCommentOutline,
  mdiCropFree,
  mdiCursorMove,
  mdiEllipse,
  mdiEraser,
  mdiFormatTextVariant,
  mdiFountainPen,
  mdiKnife,
  mdiEyedropperVariant,
  mdiFormatColorFill,
  mdiFormatText,
  mdiHandBackRight,
  mdiImagePlusOutline,
  mdiLasso,
  mdiPencil,
  mdiRectangleOutline,
  mdiResize,
  mdiSelectDrag,
  mdiSelectionDrag,
  mdiStarOutline,
  mdiTriangleOutline,
  mdiVectorLine,
} from '@mdi/js'
import type { SelectionShape } from '@/engines/canvas/canvas-selection'
import { SHAPE_KINDS, type ShapeKind } from '@/engines/canvas/shape-geometry'
import type { CanvasTool } from '@/engines/canvas/CanvasEngine'
import type { ToolbarItem } from '@/design/Toolbar'

export type ImageTool = ToolbarItem & { tool: CanvasTool }

/**
 * The bar's registry. The bar itself is `design/Toolbar` — nothing is drawn here.
 *
 * Grouped the way Figma groups its own: what points, what frames, what draws a shape, what
 * paints, what types. Hovering a group opens the rest of it; the button itself arms the mode
 * already showing, so an armed tool never needs the menu to be reachable.
 */
export const IMAGE_TOOLS: readonly ImageTool[] = [
  {
    id: 'pointer',
    tool: 'move',
    labelKey: 'imageTools.pointer',
    descriptionKey: 'imageTools.pointerHint',
    icon: mdiCursorMove,
    modes: [
      {
        id: 'move',
        labelKey: 'imageTools.move',
        descriptionKey: 'imageTools.moveHint',
        icon: mdiCursorMove,
        shortcut: 'V',
      },
      {
        id: 'hand',
        labelKey: 'imageTools.hand',
        descriptionKey: 'imageTools.handHint',
        icon: mdiHandBackRight,
        shortcut: 'H',
      },
      {
        id: 'scale',
        labelKey: 'imageTools.scale',
        descriptionKey: 'imageTools.scaleHint',
        icon: mdiResize,
        shortcut: 'K',
      },
    ],
  },
  {
    id: 'frame',
    // Greyed on the group, not only on its rows: `Toolbar` does not inherit a mode's `disabled`,
    // so the button armed a tool the engine refuses — a live-looking button that does nothing.
    disabled: true,
    tool: 'crop',
    labelKey: 'imageTools.frame',
    descriptionKey: 'imageTools.frameHint',
    icon: mdiCropFree,
    modes: [
      {
        id: 'crop',
        labelKey: 'imageTools.crop',
        descriptionKey: 'imageTools.cropHint',
        icon: mdiCropFree,
        shortcut: 'F',
        // Resizing the frame moves every layer, but a layer's texture keeps the document's old
        // size — so after a crop the brush writes at the offset the crop introduced. Greyed
        // rather than hidden, as the bar does for everything else that is coming.
        disabled: true,
      },
      {
        id: 'section',
        labelKey: 'imageTools.section',
        descriptionKey: 'imageTools.sectionHint',
        icon: mdiCardOutline,
        shortcut: '⇧S',
        disabled: true,
      },
      {
        id: 'slice',
        labelKey: 'imageTools.slice',
        descriptionKey: 'imageTools.sliceHint',
        icon: mdiKnife,
        shortcut: 'S',
        disabled: true,
      },
    ],
  },
  {
    id: 'region',
    tool: 'select',
    labelKey: 'imageTools.region',
    descriptionKey: 'imageTools.regionHint',
    icon: mdiSelectDrag,
    modes: [
      {
        id: 'rectangle',
        labelKey: 'imageTools.selectRectangle',
        descriptionKey: 'imageTools.selectRectangleHint',
        icon: mdiSelectionDrag,
        shortcut: 'M',
      },
      {
        id: 'ellipse',
        labelKey: 'imageTools.selectEllipse',
        descriptionKey: 'imageTools.selectEllipseHint',
        icon: mdiEllipse,
      },
      {
        id: 'lasso',
        labelKey: 'imageTools.selectLasso',
        descriptionKey: 'imageTools.selectLassoHint',
        icon: mdiLasso,
        shortcut: 'L',
      },
    ],
  },
  {
    id: 'shape',
    tool: 'shape',
    labelKey: 'imageTools.shape',
    descriptionKey: 'imageTools.shapeHint',
    icon: mdiRectangleOutline,
    separatorBefore: true,
    modes: [
      {
        id: 'rectangle',
        labelKey: 'imageTools.shapeRectangle',
        descriptionKey: 'imageTools.shapeRectangleHint',
        icon: mdiRectangleOutline,
        shortcut: 'R',
      },
      {
        id: 'line',
        labelKey: 'imageTools.shapeLine',
        descriptionKey: 'imageTools.shapeLineHint',
        icon: mdiVectorLine,
        shortcut: 'L',
      },
      {
        id: 'arrow',
        labelKey: 'imageTools.shapeArrow',
        descriptionKey: 'imageTools.shapeArrowHint',
        icon: mdiArrowTopRight,
        shortcut: '⇧L',
      },
      {
        id: 'ellipse',
        labelKey: 'imageTools.shapeEllipse',
        descriptionKey: 'imageTools.shapeEllipseHint',
        icon: mdiCircleOutline,
        shortcut: 'O',
      },
      {
        id: 'polygon',
        labelKey: 'imageTools.shapePolygon',
        descriptionKey: 'imageTools.shapePolygonHint',
        icon: mdiTriangleOutline,
      },
      {
        id: 'star',
        labelKey: 'imageTools.shapeStar',
        descriptionKey: 'imageTools.shapeStarHint',
        icon: mdiStarOutline,
      },
      {
        id: 'image',
        labelKey: 'imageTools.shapeImage',
        descriptionKey: 'imageTools.shapeImageHint',
        icon: mdiImagePlusOutline,
        shortcut: '⇧⌘K',
      },
    ],
  },
  {
    id: 'paint',
    tool: 'brush',
    labelKey: 'imageTools.paint',
    descriptionKey: 'imageTools.paintHint',
    icon: mdiBrush,
    modes: [
      {
        id: 'brush',
        labelKey: 'imageTools.brush',
        descriptionKey: 'imageTools.brushHint',
        icon: mdiBrush,
        shortcut: 'P',
      },
      {
        id: 'pencil',
        labelKey: 'imageTools.pencil',
        descriptionKey: 'imageTools.pencilHint',
        icon: mdiPencil,
        shortcut: '⇧P',
      },
      {
        id: 'pen',
        labelKey: 'imageTools.pen',
        descriptionKey: 'imageTools.penHint',
        icon: mdiFountainPen,
        // A vector path is not a raster stroke: it needs a path model the engine has no notion
        // of yet. Shown greyed rather than hidden, so the bar says what is coming.
        disabled: true,
      },
    ],
  },
  {
    id: 'text',
    tool: 'text',
    labelKey: 'imageTools.text',
    descriptionKey: 'imageTools.textHint',
    icon: mdiFormatText,
    modes: [
      {
        id: 'text',
        labelKey: 'imageTools.text',
        descriptionKey: 'imageTools.textHint',
        icon: mdiFormatText,
        shortcut: 'T',
      },
      {
        id: 'path',
        labelKey: 'imageTools.textPath',
        descriptionKey: 'imageTools.textPathHint',
        icon: mdiFormatTextVariant,
        disabled: true,
      },
    ],
  },
  {
    id: 'comment',
    tool: 'comment',
    labelKey: 'imageTools.comment',
    descriptionKey: 'imageTools.commentHint',
    icon: mdiCommentOutline,
    shortcut: 'C',
  },
  {
    id: 'eraser',
    tool: 'eraser',
    labelKey: 'imageTools.eraser',
    descriptionKey: 'imageTools.eraserHint',
    icon: mdiEraser,
    separatorBefore: true,
    modes: [
      {
        id: 'point',
        labelKey: 'imageTools.eraserPoint',
        descriptionKey: 'imageTools.eraserPointHint',
        icon: mdiEraser,
        shortcut: 'E',
      },
      {
        id: 'selection',
        labelKey: 'imageTools.eraserSelection',
        descriptionKey: 'imageTools.eraserSelectionHint',
        icon: mdiSelectionDrag,
      },
    ],
  },
  {
    id: 'fill',
    tool: 'fill',
    labelKey: 'imageTools.fill',
    descriptionKey: 'imageTools.fillHint',
    icon: mdiFormatColorFill,
    shortcut: 'G',
  },
  {
    id: 'picker',
    tool: 'picker',
    labelKey: 'imageTools.picker',
    descriptionKey: 'imageTools.pickerHint',
    icon: mdiEyedropperVariant,
    shortcut: 'I',
  },
]

export function toolById(id: string): ImageTool | null {
  return IMAGE_TOOLS.find(tool => tool.id === id) ?? null
}

/**
 * What the engine is actually asked to do. A group's modes do not always mean the same tool —
 * the pointer group holds both dragging the content and dragging the view, which are different
 * gestures on the same button.
 */
export function canvasToolFor(toolId: string, modeId?: string): CanvasTool | null {
  if (toolId === 'pointer') return modeId === 'hand' ? 'hand' : 'move'
  return toolById(toolId)?.tool ?? null
}

/**
 * Which shape the region tool draws. Its three modes are one tool with three gestures, the same
 * way the pointer group holds both dragging the content and dragging the view.
 */
export function selectionShapeFor(toolId: string, modeId?: string): SelectionShape | null {
  if (toolId !== 'region') return null
  if (modeId === 'ellipse') return 'ellipse'
  if (modeId === 'lasso') return 'lasso'
  return 'rect'
}

/** Which of the six the shapes tool draws. `image` is not one: it opens the shelf instead. */
export function shapeKindFor(toolId: string, modeId?: string): ShapeKind | null {
  if (toolId !== 'shape') return null
  return SHAPE_KINDS.find(kind => kind === modeId) ?? null
}

/** The mode each group opens armed with — its first row, as Figma's groups do. */
export const DEFAULT_MODES: Readonly<Record<string, string>> = Object.fromEntries(
  IMAGE_TOOLS.flatMap(tool => (tool.modes?.[0] ? [[tool.id, tool.modes[0].id]] : [])),
)

/**
 * What the pointer becomes over the canvas. No native keyword says `eyedropper` or `bucket`,
 * so those two are drawn from the icon the bar already shows for them — read off the registry,
 * so changing a tool's icon changes its cursor with it.
 */
export function cursorFor(toolId: string, modeId?: string): string {
  if (toolId === 'pointer') return modeId === 'hand' ? 'grab' : 'move'
  if (toolId === 'text') return 'text'
  return DRAWN_CURSORS[toolId] ?? 'crosshair'
}

/** Built once: the string is ~450 characters, and `cursorFor` runs on every render. */
const DRAWN_CURSORS: Record<string, string> = {
  fill: iconCursor('fill', 4, 20),
  picker: iconCursor('picker', 3, 21),
}

function iconCursor(toolId: string, hotspotX: number, hotspotY: number): string {
  const path = toolById(toolId)?.icon ?? ''
  // White fill on a dark outline, so the cursor stays visible on either. `crosshair` is the
  // fallback for the platforms that refuse an image cursor rather than leaving none.
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24">` +
    `<path d="${path}" fill="#fff" stroke="#000" stroke-width="1"/></svg>`
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, crosshair`
}
