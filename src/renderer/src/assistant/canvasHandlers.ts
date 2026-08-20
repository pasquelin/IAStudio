import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { packedColour } from '@shared/domain/color'
import { toRadians } from '@shared/domain/angles'
import { BLEND_MODES } from '@shared/domain/canvasBlend'
import {
  ADJUSTMENT_KINDS,
  adjustmentLayer,
  allLayers,
  canMoveLayer,
  DEFAULT_SHAPE_SIDES,
  layerById,
  pixelLayer,
  SHAPE_KINDS,
  shapeLayer,
  TEXT_ALIGNS,
  textLayer,
  type CanvasState,
  type DrawnShape,
  type Layer,
} from '@/engines/canvas/canvasState'
import { localShape } from '@/engines/canvas/shapeGeometry'
import type { Point, Size } from '@/engines/core/geometry'
import {
  addLayer,
  cropToRect,
  duplicateLayer,
  flipImage,
  groupLayers,
  mergeDown,
  moveLayer,
  removeLayer,
  renameLayer,
  resizeCanvas,
  resizeImage,
  rotateImage,
  setLayerBlend,
  setLayerClipped,
  setLayerFillOpacity,
  setLayerOpacity,
  setLayerText,
  setLayerTransform,
  setLayerVisible,
  ungroupLayer,
} from '@/engines/canvas/commands'
import type { Command } from '@/engines/core/history'
import { newId } from '@/helpers/ids'
import { canvasOf, selectLayerIn, useCanvases } from '@/stores/canvases'
import { activeImageId, useDocuments } from '@/stores/documents'
import type { ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf, textsOf } from './actionInputs'

/**
 * The layer stack, driven by value.
 *
 * Every one of these runs a command of `engines/canvas/commands.ts` — the same ones the panels
 * run, so an edit made from outside undoes exactly like one made with the mouse.
 */

type Commands = readonly Command<CanvasState>[]

/** The image in front and its state, or nothing — which reads as `wrongSurface`. */
function mounted(): { documentId: string; state: CanvasState } | null {
  const documentId = activeImageId(useDocuments.getState())
  return documentId === null
    ? null
    : { documentId, state: canvasOf(useCanvases.getState(), documentId) }
}

/**
 * One entry per command, deliberately — NOT wrapped in a gesture. Coalescing only merges commands
 * sharing an `id`, keeping the FIRST one's `revert`: a gesture around three different dials would
 * undo the opacity and leave the blend mode set.
 */
function run(documentId: string, commands: Commands): ActionOutcome {
  if (commands.length === 0) return refused('badInput')

  const store = useCanvases.getState()
  for (const command of commands) store.runCommand(documentId, command)
  return { ok: true }
}

/** Edits the image in front, whatever the stack holds. */
function edit(build: (state: CanvasState) => Commands): ActionOutcome {
  const open = mounted()
  return open ? run(open.documentId, build(open.state)) : refused('wrongSurface')
}

/**
 * The same, for one named layer, found before anything runs.
 *
 * The lookup is the point: a command whose layer is gone answers by returning the state
 * untouched, so without it every miss would be reported as done.
 */
function editLayer(
  input: Record<string, unknown>,
  build: (layer: Layer, state: CanvasState) => Commands,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const layer = layerById(open.state, textOf(input, 'layerId'))
  return layer ? run(open.documentId, build(layer, open.state)) : refused('notFound')
}

function readState(): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  return {
    ok: true,
    data: {
      documentId: open.documentId,
      width: open.state.width,
      height: open.state.height,
      dpi: open.state.dpi,
      activeLayerId: open.state.activeLayerId,
      guides: open.state.guides,
      // Flattened: a client that had to walk a tree to find a layer id would walk it wrong the
      // first time a group was collapsed.
      layers: allLayers(open.state.layers).map(layer => ({
        id: layer.id,
        name: layer.name,
        kind: layer.kind,
        visible: layer.visible,
        opacity: layer.opacity,
        blend: layer.blend,
        clipped: layer.clipped,
        transform: layer.transform,
        ...(layer.kind === 'text'
          ? { text: layer.text, size: layer.size, align: layer.align, box: layer.box }
          : {}),
        ...(layer.kind === 'adjustment' ? { adjustment: layer.adjustment } : {}),
        ...(layer.kind === 'shape'
          ? { shape: layer.shape, fill: layer.fill, stroke: layer.stroke }
          : {}),
      })),
    },
  }
}

/**
 * A shape from a box rather than from a drag: a client has a rectangle, not a hand. The two
 * points are the box's own corners, which is what the layer stores.
 */
function drawnShape(input: Record<string, unknown>): { at: Point; drawn: DrawnShape } | null {
  const shape = oneOf(input, 'shape', SHAPE_KINDS)
  const width = numberOf(input, 'width')
  const height = numberOf(input, 'height')
  if (!shape || width === null || height === null || width <= 0 || height <= 0) return null

  const ink = numberOf(input, 'fill') ?? 0x000000
  // Open by nature: a line and an arrow have no inside, so filling one paints nothing at all.
  const open = shape === 'line' || shape === 'arrow'
  const sides = numberOf(input, 'sides') ?? DEFAULT_SHAPE_SIDES
  // A ring is drawn from its CENTRE outwards, so the box's middle is where its drag began, and
  // its far point is the corner — a point on the middle of an edge would ignore one axis.
  const ring = shape === 'polygon' || shape === 'star'
  const from = ring ? { x: width / 2, y: height / 2 } : { x: 0, y: 0 }
  const to = { x: width, y: height }

  // Through the very helper the hand's own drag goes through: a ring reaches past the corner it
  // was given, and a point left negative falls outside the layer's texture and is clipped away.
  const local = localShape(shape, from, to, sides, open ? DEFAULT_STROKE_WIDTH : 0)
  return {
    at: local.at,
    drawn: {
      shape,
      from: local.from,
      to: local.to,
      sides,
      fill: open ? null : ink,
      stroke: open ? { color: ink, width: DEFAULT_STROKE_WIDTH } : null,
    },
  }
}

/** What an assistant-drawn line is stroked with, having no brush size to read one from. */
const DEFAULT_STROKE_WIDTH = 2

/** The other axis of a box a client half-named, giving a point caption one for the first time. */
const DEFAULT_PARAGRAPH: Size = { width: 480, height: 120 }

function born(input: Record<string, unknown>, id: string, name: string): Layer | null {
  switch (oneOf(input, 'kind', ['pixel', 'text', 'adjustment', 'shape'])) {
    case 'pixel':
      return pixelLayer(id, name)
    case 'shape': {
      const made = drawnShape(input)
      if (!made) return null
      // `x` and `y` name where the client wants the BOX, and `localShape` says how far the shape
      // reaches past it — a stroke widens the box on every side.
      const at = { x: numberOf(input, 'x') ?? 0, y: numberOf(input, 'y') ?? 0 }
      return shapeLayer(id, name, { x: at.x + made.at.x, y: at.y + made.at.y }, made.drawn)
    }
    case 'text':
      // `textLayer` names the layer after its own text; `name` is required here and is what a
      // client will look the layer up by, so it wins.
      return {
        ...textLayer(id, textOf(input, 'text') ?? name, {
          x: numberOf(input, 'x') ?? 0,
          y: numberOf(input, 'y') ?? 0,
        }),
        name,
      }
    case 'adjustment': {
      const adjustment = oneOf(input, 'adjustment', ADJUSTMENT_KINDS)
      // An adjustment layer with no dial named would be a row in the panel that changes nothing.
      return adjustment ? adjustmentLayer(id, name, adjustment) : null
    }
    default:
      return null
  }
}

function newLayer(input: Record<string, unknown>): ActionOutcome {
  const name = textOf(input, 'name')
  const id = newId()
  const layer = name === null ? null : born(input, id, name)
  if (!layer) return refused('badInput')

  const outcome = edit(() => [addLayer(layer)])
  return outcome.ok ? { ok: true, data: { layerId: id } } : outcome
}

function style(input: Record<string, unknown>): ActionOutcome {
  const opacity = numberOf(input, 'opacity')
  const fillOpacity = numberOf(input, 'fillOpacity')
  const blend = oneOf(input, 'blend', BLEND_MODES)

  return editLayer(input, ({ id }) => [
    ...(opacity === null ? [] : [setLayerOpacity(id, opacity)]),
    ...(fillOpacity === null ? [] : [setLayerFillOpacity(id, fillOpacity)]),
    ...(blend ? [setLayerBlend(id, blend)] : []),
    ...(input.visible === undefined ? [] : [setLayerVisible(id, boolOf(input, 'visible'))]),
    ...(input.clipped === undefined ? [] : [setLayerClipped(id, boolOf(input, 'clipped'))]),
  ])
}

function transform(input: Record<string, unknown>): ActionOutcome {
  const degrees = numberOf(input, 'rotation')

  return editLayer(input, layer => [
    setLayerTransform(layer.id, {
      ...layer.transform,
      x: numberOf(input, 'x') ?? layer.transform.x,
      y: numberOf(input, 'y') ?? layer.transform.y,
      scaleX: numberOf(input, 'scaleX') ?? layer.transform.scaleX,
      scaleY: numberOf(input, 'scaleY') ?? layer.transform.scaleY,
      // Degrees in, radians stored: a client writing 90 for a quarter turn is right more often
      // than one writing 1.5707963.
      rotation: degrees === null ? layer.transform.rotation : toRadians(degrees),
    }),
  ])
}

function text(input: Record<string, unknown>): ActionOutcome {
  const colour = packedColour(textOf(input, 'color') ?? '')
  const size = numberOf(input, 'size')
  const written = textOf(input, 'text')
  const align = oneOf(input, 'align', TEXT_ALIGNS)
  const lineHeight = numberOf(input, 'lineHeight')
  const tracking = numberOf(input, 'tracking')
  const width = numberOf(input, 'width')
  const height = numberOf(input, 'height')

  return editLayer(input, layer =>
    // The command only touches a text layer, so a pixel layer named here would be reported as
    // done while nothing changed.
    layer.kind === 'text'
      ? [
          setLayerText(layer.id, {
            ...(written === null ? {} : { text: written }),
            ...(size === null ? {} : { size }),
            ...(colour === null ? {} : { color: colour }),
            ...(align === null ? {} : { align }),
            ...(lineHeight === null ? {} : { lineHeight }),
            ...(tracking === null ? {} : { tracking }),
            // One axis at a time: a client naming only a width must not flatten the height. A
            // POINT caption has no box at all, so naming one is what gives it a box — and
            // `DEFAULT_PARAGRAPH` is what the other axis then starts at.
            ...(width === null && height === null
              ? {}
              : {
                  box: {
                    width: width ?? layer.box?.width ?? DEFAULT_PARAGRAPH.width,
                    height: height ?? layer.box?.height ?? DEFAULT_PARAGRAPH.height,
                  },
                }),
          }),
        ]
      : [],
  )
}

function duplicate(input: Record<string, unknown>): ActionOutcome {
  const copyId = newId()
  const outcome = editLayer(input, layer => [
    duplicateLayer(layer.id, copyId, textOf(input, 'name') ?? layer.name, newId),
  ])

  return outcome.ok ? { ok: true, data: { layerId: copyId } } : outcome
}

function group(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const layerIds = textsOf(input, 'layerIds')
  const name = textOf(input, 'name')
  if (layerIds.length === 0 || name === null) return refused('badInput')

  // Top level only, which is all `groupLayers` gathers: an id that names nothing, or one that sits
  // INSIDE a group, would otherwise be dropped in silence and the group answered for regardless.
  const top = new Set(open.state.layers.map(layer => layer.id))
  if (layerIds.some(id => !top.has(id))) return refused('notFound')

  const groupId = newId()
  const outcome = run(open.documentId, [groupLayers(layerIds, groupId, name)])
  return outcome.ok ? { ok: true, data: { layerId: groupId } } : outcome
}

function select(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const layer = layerById(open.state, textOf(input, 'layerId'))
  if (!layer) return refused('notFound')

  // Not a command: arming a layer is a way of looking at the stack, not an edit of it.
  selectLayerIn(open.documentId, layer.id)
  return { ok: true }
}

function resize(input: Record<string, unknown>): ActionOutcome {
  const width = numberOf(input, 'width')
  const height = numberOf(input, 'height')
  if (width === null || height === null) return refused('badInput')

  return edit(() => [
    boolOf(input, 'scalePixels')
      ? resizeImage(width, height)
      : resizeCanvas(width, height, { x: 0, y: 0 }),
  ])
}

function crop(input: Record<string, unknown>): ActionOutcome {
  const x = numberOf(input, 'x')
  const y = numberOf(input, 'y')
  const width = numberOf(input, 'width')
  const height = numberOf(input, 'height')
  if (x === null || y === null || width === null || height === null) return refused('badInput')

  return edit(() => [cropToRect({ x, y, width, height })])
}

const TURNS: Record<string, () => Command<CanvasState>> = {
  flipHorizontal: () => flipImage('horizontal'),
  flipVertical: () => flipImage('vertical'),
  rotateClockwise: () => rotateImage(true),
  rotateAnticlockwise: () => rotateImage(false),
}

export const CANVAS_HANDLERS: ActionHandlers = {
  'canvas.state': readState,
  'canvas.resize': resize,
  'canvas.crop': crop,
  'canvas.orient': input => {
    const turn = TURNS[textOf(input, 'turn') ?? '']
    return turn ? edit(() => [turn()]) : refused('badInput')
  },
  'layer.add': newLayer,
  'layer.remove': input => editLayer(input, layer => [removeLayer(layer.id)]),
  'layer.select': select,
  'layer.rename': input => {
    const name = textOf(input, 'name')
    return name === null
      ? refused('badInput')
      : editLayer(input, layer => [renameLayer(layer.id, name)])
  },
  'layer.style': style,
  'layer.transform': transform,
  'layer.text': text,
  'layer.move': input => {
    const index = numberOf(input, 'index')
    if (index === null) return refused('badInput')

    const parentId = textOf(input, 'parentId')
    // `moveLayer` refuses a parent that is not a group, the layer itself, or one of its own
    // descendants by handing the state back untouched — all three would read as done.
    return editLayer(input, (layer, state) =>
      canMoveLayer(state, layer.id, parentId) ? [moveLayer(layer.id, parentId, index)] : [],
    )
  },
  'layer.duplicate': duplicate,
  'layer.group': group,
  'layer.ungroup': input => editLayer(input, layer => [ungroupLayer(layer.id)]),
  'layer.mergeDown': input => editLayer(input, layer => [mergeDown(layer.id)]),
}
