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
import type { CommandId } from '@shared/domain/command'
import type { SelectionShape } from '@/engines/canvas/canvas-selection'
import { SHAPE_KINDS, type ShapeKind } from '@/engines/canvas/shape-geometry'
import type { CanvasTool } from '@/engines/canvas/canvas-tool'
import type { ToolbarItem } from '@/design/Toolbar'

export type ImageTool = ToolbarItem & { tool: CanvasTool }

/**
 * Which command arms which button. The bar carries no key of its own: it reads them off the
 * registry through this table, so a key remapped in the settings moves on the button with it.
 *
 * Written out rather than derived from the ids: a button and a command are two vocabularies, and
 * guessing one from the other would make renaming either a silent breakage.
 */
export type ToolCommand = { command: CommandId; tool: string; mode?: string }

export const TOOL_COMMANDS: readonly ToolCommand[] = [
  { command: 'canvas.toolMove', tool: 'pointer', mode: 'move' },
  { command: 'canvas.toolHand', tool: 'pointer', mode: 'hand' },
  { command: 'canvas.toolScale', tool: 'pointer', mode: 'scale' },
  { command: 'canvas.toolCrop', tool: 'frame', mode: 'crop' },
  { command: 'canvas.toolSelectRectangle', tool: 'region', mode: 'rectangle' },
  { command: 'canvas.toolSelectEllipse', tool: 'region', mode: 'ellipse' },
  { command: 'canvas.toolSelectLasso', tool: 'region', mode: 'lasso' },
  { command: 'canvas.toolShapeRectangle', tool: 'shape', mode: 'rectangle' },
  { command: 'canvas.toolShapeLine', tool: 'shape', mode: 'line' },
  { command: 'canvas.toolShapeArrow', tool: 'shape', mode: 'arrow' },
  { command: 'canvas.toolShapeEllipse', tool: 'shape', mode: 'ellipse' },
  { command: 'canvas.toolShapePolygon', tool: 'shape', mode: 'polygon' },
  { command: 'canvas.toolShapeStar', tool: 'shape', mode: 'star' },
  { command: 'canvas.toolBrush', tool: 'paint', mode: 'brush' },
  { command: 'canvas.toolPencil', tool: 'paint', mode: 'pencil' },
  { command: 'canvas.toolText', tool: 'text', mode: 'text' },
  { command: 'canvas.toolEraser', tool: 'eraser', mode: 'point' },
  { command: 'canvas.toolEraserSelection', tool: 'eraser', mode: 'selection' },
  { command: 'canvas.toolFill', tool: 'fill' },
  { command: 'canvas.toolPicker', tool: 'picker' },
]

/** The command that arms a button, so the bar can ask the registry what key it wears. */
export function armingCommand(toolId: string, modeId?: string): CommandId | null {
  const found = TOOL_COMMANDS.find(
    entry => entry.tool === toolId && (entry.mode ?? undefined) === modeId,
  )
  return found?.command ?? null
}

/** What a command arms, for the one handler that answers all of them. */
export function armedBy(command: CommandId): ToolCommand | null {
  return TOOL_COMMANDS.find(entry => entry.command === command) ?? null
}

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
      },
      {
        id: 'hand',
        labelKey: 'imageTools.hand',
        descriptionKey: 'imageTools.handHint',
        icon: mdiHandBackRight,
      },
      {
        id: 'scale',
        labelKey: 'imageTools.scale',
        descriptionKey: 'imageTools.scaleHint',
        icon: mdiResize,
      },
    ],
  },
  {
    id: 'frame',
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
      },
      {
        id: 'section',
        labelKey: 'imageTools.section',
        descriptionKey: 'imageTools.sectionHint',
        icon: mdiCardOutline,
        disabled: true,
      },
      {
        id: 'slice',
        labelKey: 'imageTools.slice',
        descriptionKey: 'imageTools.sliceHint',
        icon: mdiKnife,
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
      },
      {
        id: 'line',
        labelKey: 'imageTools.shapeLine',
        descriptionKey: 'imageTools.shapeLineHint',
        icon: mdiVectorLine,
      },
      {
        id: 'arrow',
        labelKey: 'imageTools.shapeArrow',
        descriptionKey: 'imageTools.shapeArrowHint',
        icon: mdiArrowTopRight,
      },
      {
        id: 'ellipse',
        labelKey: 'imageTools.shapeEllipse',
        descriptionKey: 'imageTools.shapeEllipseHint',
        icon: mdiCircleOutline,
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
      },
      {
        id: 'pencil',
        labelKey: 'imageTools.pencil',
        descriptionKey: 'imageTools.pencilHint',
        icon: mdiPencil,
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
    // Greyed on the group, not only on its rows: `Toolbar` does not inherit a mode's `disabled`,
    // so the button armed a tool the engine drops every pointer event of — a live-looking button
    // that changed the cursor and did nothing.
    disabled: true,
    tool: 'comment',
    labelKey: 'imageTools.comment',
    descriptionKey: 'imageTools.commentHint',
    icon: mdiCommentOutline,
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
  },
  {
    id: 'picker',
    tool: 'picker',
    labelKey: 'imageTools.picker',
    descriptionKey: 'imageTools.pickerHint',
    icon: mdiEyedropperVariant,
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
  // The pencil is not a mode of the brush for the engine: the two lay the same disc down and
  // differ on the edge, which is the whole of what the bundle promises about them.
  if (toolId === 'paint') return modeId === 'pencil' ? 'pencil' : 'brush'
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
