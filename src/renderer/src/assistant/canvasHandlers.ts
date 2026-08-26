import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { Target } from '@shared/domain/target'
import { packedColour } from '@shared/domain/color'
import { toRadians } from '@shared/domain/angles'
import { BLEND_MODES } from '@shared/domain/canvasBlend'
import { embeddedFontOf, FONT_SOURCES, type FontRef } from '@shared/domain/font'
import {
  ADJUSTMENT_KINDS,
  adjustmentLayer,
  allLayers,
  canMoveLayer,
  DEFAULT_SHAPE_SIDES,
  layerById,
  LOCK_KEYS,
  pixelLayer,
  SHAPE_KINDS,
  shapeLayer,
  TEXT_ALIGNS,
  textLayer,
  GUIDE_AXES,
  type CanvasState,
  type DrawnShape,
  type Guide,
  type Layer,
} from '@/engines/canvas/canvasState'
import {
  DEFAULT_STROKE_WIDTH,
  isOpenShape,
  localShape,
  SHAPE_INK,
} from '@/engines/canvas/shapeGeometry'
import type { Point, Size } from '@/engines/core/geometry'
import {
  addGuide,
  addLayer,
  cropToRect,
  duplicateLayer,
  flipImage,
  groupLayers,
  mergeDown,
  moveGuide,
  moveLayer,
  removeGuide,
  removeLayer,
  renameLayer,
  resizeCanvas,
  resizeImage,
  rotateImage,
  setLayerAdjustment,
  setLayerMask,
  setLayerBlend,
  setLayerClipped,
  setLayerFillOpacity,
  setLayerLocks,
  setLayerOpacity,
  setLayerShape,
  setLayerText,
  setLayerTransform,
  setLayerVisible,
  ungroupLayer,
} from '@/engines/canvas/commands'
import type { Command } from '@/engines/core/history'
import { newId } from '@/helpers/ids'
import { turnPort } from '@/spaces/image/turnPort'
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

/**
 * Edits the image in front, whatever the stack holds. The document's id is handed to the builder
 * as well as its state: a command that reaches the ENGINE — a quarter turn — needs to say which.
 */
function edit(build: (state: CanvasState, documentId: string) => Commands): ActionOutcome {
  const open = mounted()
  return open ? run(open.documentId, build(open.state, open.documentId)) : refused('wrongSurface')
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
        // The three that were written and never read: a client could raise `fillOpacity`, lock a
        // layer and carve a mask, and had no way of learning that any of it had taken.
        fillOpacity: layer.fillOpacity,
        locked: layer.locked,
        ...(layer.mask ? { mask: layer.mask } : {}),
        blend: layer.blend,
        clipped: layer.clipped,
        transform: layer.transform,
        ...(layer.kind === 'text'
          ? {
              text: layer.text,
              size: layer.size,
              align: layer.align,
              box: layer.box,
              font: layer.font,
            }
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

  const ink = packedColour(textOf(input, 'fill') ?? '') ?? SHAPE_INK
  const open = isOpenShape(shape)
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
  const by = boolOf(input, 'relative')

  // A move is ADDED and a scale MULTIPLIED — « 100 pixels à droite » against « de 20 % ».
  const shifted = (key: string, held: number): number => {
    const given = numberOf(input, key)
    if (given === null) return held
    if (!by) return given

    return key.startsWith('scale') ? held * given : held + given
  }

  return editLayer(input, layer => [
    setLayerTransform(layer.id, {
      ...layer.transform,
      x: shifted('x', layer.transform.x),
      y: shifted('y', layer.transform.y),
      scaleX: shifted('scaleX', layer.transform.scaleX),
      scaleY: shifted('scaleY', layer.transform.scaleY),
      // Degrees in, radians stored: a client writing 90 for a quarter turn is right more often
      // than one writing 1.5707963.
      rotation:
        degrees === null
          ? layer.transform.rotation
          : by
            ? layer.transform.rotation + toRadians(degrees)
            : toRadians(degrees),
    }),
  ])
}

/**
 * The face, or nothing when `embedded` is claimed for a family the studio does not ship — the one
 * promise `source` carries is that the document opens the same elsewhere, and that one would not.
 */
function fontRefOf(input: Record<string, unknown>, family: string): FontRef | null {
  const shipped = embeddedFontOf(family) !== null
  const source = oneOf(input, 'fontSource', FONT_SOURCES) ?? (shipped ? 'embedded' : 'system')

  return source === 'embedded' && !shipped ? null : { source, family }
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
  const family = textOf(input, 'fontFamily')
  const font = family === null ? null : fontRefOf(input, family)
  // An `embedded` face the studio does not ship: refused rather than written as a reference that
  // will not resolve on the next machine.
  if (family !== null && font === null) return refused('badInput')

  return editLayer(input, layer =>
    // The command only touches a text layer, so a pixel layer named here would be reported as
    // done while nothing changed.
    layer.kind === 'text'
      ? [
          setLayerText(layer.id, {
            ...(written === null ? {} : { text: written }),
            ...(font === null ? {} : { font }),
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

function locks(input: Record<string, unknown>): ActionOutcome {
  return editLayer(input, layer => {
    const named = LOCK_KEYS.filter(padlock => input[padlock] !== undefined)
    // A call naming no padlock at all is a refusal, which `run` makes of an empty list.
    if (named.length === 0) return []

    const wanted = Object.fromEntries(named.map(padlock => [padlock, boolOf(input, padlock)]))
    return [setLayerLocks(layer.id, { ...layer.locked, ...wanted })]
  })
}

function shape(input: Record<string, unknown>): ActionOutcome {
  const fill = packedColour(textOf(input, 'fill') ?? '')
  const stroke = packedColour(textOf(input, 'stroke') ?? '')
  const strokeWidth = numberOf(input, 'strokeWidth')
  const sides = numberOf(input, 'sides')
  const filled = input.filled === undefined ? null : boolOf(input, 'filled')
  const stroked = input.stroked === undefined ? null : boolOf(input, 'stroked')

  return editLayer(input, layer => {
    // A line and an arrow have no inside, and the panel hides the switch for them: filling one
    // from outside would answer `ok` for paint nobody can see.
    if (layer.kind !== 'shape') return []
    if (isOpenShape(layer.shape) && (filled !== null || fill !== null)) return []

    const painted =
      filled === null ? (fill ?? layer.fill) : filled ? (fill ?? layer.fill ?? SHAPE_INK) : null
    const keeps = stroked === null && stroke === null && strokeWidth === null
    const outlined =
      stroked === false
        ? null
        : keeps
          ? layer.stroke
          : {
              color: stroke ?? layer.stroke?.color ?? SHAPE_INK,
              width: strokeWidth ?? layer.stroke?.width ?? DEFAULT_STROKE_WIDTH,
            }

    // The panel answers this by switching the other one back on, which is right under a finger
    // and wrong here: a client that asked for both to go hears that it cannot have that.
    if (painted === null && outlined === null) return []

    return [
      setLayerShape(layer.id, {
        fill: painted,
        stroke: outlined,
        ...(sides === null ? {} : { sides }),
      }),
    ]
  })
}

/**
 * The one dial the layer carries. A field naming another is refused rather than dropped: written
 * into the stack it would be carried, neutral and invisible, by a pass that never reads it.
 */
function adjustment(input: Record<string, unknown>): ActionOutcome {
  return editLayer(input, layer => {
    if (layer.kind !== 'adjustment') return []

    const named = ADJUSTMENT_KINDS.filter(kind => input[kind] !== undefined)
    if (named.length !== 1 || named[0] !== layer.adjustment) return []

    const value = numberOf(input, layer.adjustment)
    return value === null
      ? []
      : [setLayerAdjustment(layer.id, { ...layer.values, [layer.adjustment]: value })]
  })
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

/**
 * The layers of the image in front, as things a sentence may aim at — topmost first, which is the
 * order the stack panel shows. Flattened as `canvas.state` flattens: a name is what a person says,
 * and where the group tree puts it is not something they can be asked to spell.
 */
export function layerTargets(): readonly Target[] {
  const open = mounted()
  if (!open) return []

  return allLayers(open.state.layers)
    .map((layer): Target => ({
      id: layer.id,
      kind: 'layer',
      name: layer.name,
      selected: layer.id === open.state.activeLayerId,
    }))
    .reverse()
}

export function selectLayer(input: Record<string, unknown>): ActionOutcome {
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

/**
 * The four document-wide turns. A quarter turn takes the document it runs on, because it turns
 * the PIXELS through that document's engine — the mirrors do not, a negative scale being the
 * whole of what they change.
 */
const TURNS: Record<string, (documentId: string) => Command<CanvasState>> = {
  flipHorizontal: () => flipImage('horizontal'),
  flipVertical: () => flipImage('vertical'),
  rotateClockwise: documentId => rotateImage(true, turnPort(documentId)),
  rotateAnticlockwise: documentId => rotateImage(false, turnPort(documentId)),
}

// A layer wearing no mask is refused rather than given a record with no pixels behind it:
// carving one is the engine's, through `canvas.maskFromSelection`.
function mask(input: Record<string, unknown>): ActionOutcome {
  const remove = boolOf(input, 'remove')
  const named = ['enabled', 'linked'].some(key => input[key] !== undefined)
  // Taking a mask away and saying what it does are two different calls: one of them would be
  // written into a record the other has just dropped.
  if (remove && named) return refused('badInput')

  return editLayer(input, layer => {
    if (!layer.mask || (!remove && !named)) return []

    return [
      setLayerMask(
        layer.id,
        remove
          ? undefined
          : {
              enabled: input.enabled === undefined ? layer.mask.enabled : boolOf(input, 'enabled'),
              linked: input.linked === undefined ? layer.mask.linked : boolOf(input, 'linked'),
            },
      ),
    ]
  })
}

/** The guide named, so an id nobody answers to is a refusal rather than a command that writes
 * nothing. */
function editGuide(
  input: Record<string, unknown>,
  build: (guide: Guide) => Commands,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const guide = open.state.guides.find(held => held.id === textOf(input, 'guideId'))
  return guide ? run(open.documentId, build(guide)) : refused('notFound')
}

export const CANVAS_HANDLERS: ActionHandlers = {
  'canvas.state': readState,
  'canvas.resize': resize,
  'canvas.crop': crop,
  'canvas.orient': input => {
    const turn = TURNS[textOf(input, 'turn') ?? '']
    return turn ? edit((_state, documentId) => [turn(documentId)]) : refused('badInput')
  },
  'layer.add': newLayer,
  'layer.remove': input => editLayer(input, layer => [removeLayer(layer.id)]),
  'layer.select': selectLayer,
  'layer.rename': input => {
    const name = textOf(input, 'name')
    return name === null
      ? refused('badInput')
      : editLayer(input, layer => [renameLayer(layer.id, name)])
  },
  'layer.style': style,
  'layer.lock': locks,
  'layer.shape': shape,
  'layer.adjustment': adjustment,
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
  'layer.mask': mask,

  'guide.add': input => {
    const open = mounted()
    const axis = oneOf(input, 'axis', GUIDE_AXES)
    if (!open) return refused('wrongSurface')
    if (!axis) return refused('badInput')

    const guide = { id: newId(), axis, position: numberOf(input, 'position') ?? 0 }
    const outcome = run(open.documentId, [addGuide(guide)])
    return outcome.ok ? { ok: true, data: { guideId: guide.id } } : outcome
  },

  'guide.move': input =>
    editGuide(input, guide => [moveGuide(guide.id, numberOf(input, 'position') ?? guide.position)]),

  'guide.remove': input => editGuide(input, guide => [removeGuide(guide.id)]),
}
