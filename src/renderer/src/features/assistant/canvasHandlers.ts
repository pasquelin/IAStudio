import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { aimedAt, type Target } from '@shared/domain/target'
import { packedColour } from '@shared/domain/color'
import { toDegrees, toRadians } from '@shared/domain/angles'
import { BLEND_MODES } from '@shared/domain/canvasBlend'
import { PIXEL_SHAPES, type PixelShape } from '@shared/domain/pixelShape'
import { embeddedFontOf, FONT_SOURCES, type FontRef } from '@shared/domain/font'
import {
  ADJUSTMENT_KINDS,
  type LayerLocks,
  type Transform as LayerTransform,
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
import { cellRect, cellsOfLine, cellsOfRect, gridOf } from '@/engines/canvas/pixelGrid'
import { canvasHost } from '@/features/image/canvasHosts'
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
  setPixelCell,
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
import { turnPort } from '@/features/image/turnPort'
import { canvasOf, selectLayerIn, useCanvases } from '@/stores/canvases'
import { activeImageId, useDocuments } from '@/stores/documents'
import type { ActionHandlers } from './actionHandler'
import { boolOf, composedNumber, namedOf, numberOf, oneOf, textOf, textsOf } from './actionInputs'

/**
 * The layer stack, driven by value.
 *
 * Every one of these runs a command of `engines/canvas/commands.ts` — the same ones the panels
 * run, so an edit made from outside undoes exactly like one made with the mouse.
 */

type Commands = readonly Command<CanvasState>[]

/** What a caller does about it, spelled once for the eight sites that answer `wrongSurface`. */
const NO_IMAGE =
  'the document in front is no image — documents.list answers what is open and of which kind, and ' +
  'document.activate brings an image forward'

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
function run(
  documentId: string,
  commands: Commands,
  /** What a caller does when the builder declines — only the caller knows what it was after. */
  nothing: string,
): ActionOutcome {
  if (commands.length === 0) return refused('badInput', nothing)

  const store = useCanvases.getState()
  for (const command of commands) store.runCommand(documentId, command)
  return { ok: true }
}

/**
 * Edits the image in front, whatever the stack holds. The document's id is handed to the builder
 * as well as its state: a command that reaches the ENGINE — a quarter turn — needs to say which.
 */
function edit(
  build: (state: CanvasState, documentId: string) => Commands,
  nothing: string,
): ActionOutcome {
  const open = mounted()
  return open
    ? run(open.documentId, build(open.state, open.documentId), nothing)
    : refused('wrongSurface', NO_IMAGE)
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
  /** What a caller does when the layer IS there and the builder still declines. */
  nothing: string,
  /** What the call answers, read off the layer AFTER the commands — see `namedOf`. */
  answer?: (layer: Layer) => unknown,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_IMAGE)

  const named = textOf(input, 'layerId')
  const layer = layerAimed(open.state, named)
  if (!layer) return refused('notFound', noLayer(named))

  const outcome = run(open.documentId, build(layer, open.state), nothing)
  if (!outcome.ok || !answer) return outcome

  const after = layerById(canvasOf(useCanvases.getState(), open.documentId), layer.id)
  return after ? { ok: true, data: answer(after) } : outcome
}

/** What a caller does about a layer nobody answers to — spelled once for the two sites. */
const noLayer = (named: string | null): string =>
  `no layer "${named ?? ''}" in the image in front, by id or name — canvas.state answers "layers" ` +
  'with their ids and their names'

/** The layer a caller meant, by id or by the name the briefing showed it under. */
function layerAimed(state: CanvasState, given: string | null): Layer | undefined {
  return aimedAt(allLayers(state.layers), id => layerById(state, id), given)
}

/** Whether any of a layer's three locks is on — all three off is what a fresh layer holds. */
const anyLock = (locked: LayerLocks): boolean => locked.pixels || locked.position || locked.alpha

/** Whether a layer sits where a fresh one does: unmoved, unscaled, unturned, unskewed. */
const placedFlat = (transform: LayerTransform): boolean =>
  transform.x === 0 &&
  transform.y === 0 &&
  transform.scaleX === 1 &&
  transform.scaleY === 1 &&
  transform.rotation === 0 &&
  transform.skewX === 0 &&
  transform.skewY === 0

function readState(): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_IMAGE)

  const grid = gridOf(open.state)
  return {
    ok: true,
    data: {
      documentId: open.documentId,
      width: open.state.width,
      height: open.state.height,
      dpi: open.state.dpi,
      // Derived rather than stored, and the only thing a client needs in order to place a cell:
      // asked to work it out from a size and a cell, a model gets it wrong one time in three.
      ...(grid === null ? {} : { pixelArt: grid }),
      activeLayerId: open.state.activeLayerId,
      guides: open.state.guides,
      // Flattened: a client that had to walk a tree to find a layer id would walk it wrong the
      // first time a group was collapsed.
      /**
       * 🛑 A value AT ITS DEFAULT is left out, and absent reads as that default: a layer is drawn,
       * whole, unlocked, blended normally, uncut and untransformed. `resultLine` cuts by whole
       * members and `layers` is the last one, so a stack of four spent 290 characters a layer
       * saying « unchanged » and came back cut before the one a sentence named.
       */
      layers: allLayers(open.state.layers).map(layer => ({
        id: layer.id,
        name: layer.name,
        kind: layer.kind,
        ...(layer.visible ? {} : { visible: false }),
        ...(layer.opacity === 1 ? {} : { opacity: layer.opacity }),
        // The three that were written and never read: a client could raise `fillOpacity`, lock a
        // layer and carve a mask, and had no way of learning that any of it had taken.
        ...(layer.fillOpacity === 1 ? {} : { fillOpacity: layer.fillOpacity }),
        ...(anyLock(layer.locked) ? { locked: layer.locked } : {}),
        ...(layer.mask ? { mask: layer.mask } : {}),
        ...(layer.blend === 'normal' ? {} : { blend: layer.blend }),
        ...(layer.clipped ? { clipped: true } : {}),
        ...(placedFlat(layer.transform) ? {} : { transform: layer.transform }),
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
  if (!layer)
    return refused(
      'badInput',
      '"name" is required, and "kind" must be one of: pixel, text, adjustment, shape — a shape also wants "shape" and a "width" and "height" above zero, an adjustment wants "adjustment"',
    )

  const outcome = edit(() => [addLayer(layer)], 'the new layer built no command to run')
  return outcome.ok ? { ok: true, data: { layerId: id } } : outcome
}

function style(input: Record<string, unknown>): ActionOutcome {
  const opacity = numberOf(input, 'opacity')
  const fillOpacity = numberOf(input, 'fillOpacity')
  const blend = oneOf(input, 'blend', BLEND_MODES)

  return editLayer(
    input,
    ({ id }) => [
      ...(opacity === null ? [] : [setLayerOpacity(id, opacity)]),
      ...(fillOpacity === null ? [] : [setLayerFillOpacity(id, fillOpacity)]),
      ...(blend ? [setLayerBlend(id, blend)] : []),
      ...(input.visible === undefined ? [] : [setLayerVisible(id, boolOf(input, 'visible'))]),
      ...(input.clipped === undefined ? [] : [setLayerClipped(id, boolOf(input, 'clipped'))]),
    ],
    'this call named nothing to set: opacity, fillOpacity, blend, visible or clipped',
    layer => namedOf(input, layer),
  )
}

function transform(input: Record<string, unknown>): ActionOutcome {
  const degrees = numberOf(input, 'rotation')
  const by = boolOf(input, 'relative')

  const shifted = (key: string, held: number, how: 'add' | 'multiply'): number =>
    composedNumber(held, numberOf(input, key), by, how)

  return editLayer(
    input,
    layer => [
      setLayerTransform(layer.id, {
        ...layer.transform,
        x: shifted('x', layer.transform.x, 'add'),
        y: shifted('y', layer.transform.y, 'add'),
        scaleX: shifted('scaleX', layer.transform.scaleX, 'multiply'),
        scaleY: shifted('scaleY', layer.transform.scaleY, 'multiply'),
        // Degrees in, radians stored: a client writing 90 for a quarter turn is right more often
        // than one writing 1.5707963.
        rotation: composedNumber(
          layer.transform.rotation,
          degrees === null ? null : toRadians(degrees),
          by,
          'add',
        ),
      }),
    ],
    'nothing to move: this layer takes x, y, scaleX, scaleY or rotation',
    // Degrees back, as they came in.
    layer => ({
      ...namedOf(input, layer.transform),
      ...(degrees === null ? {} : { rotation: toDegrees(layer.transform.rotation) }),
    }),
  )
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
  if (family !== null && font === null)
    return refused(
      'badInput',
      `no embedded face "${family ?? ''}" ships with the studio — fonts.list answers which do, or send fontSource "system" to use one of this machine's`,
    )

  return editLayer(
    input,
    layer =>
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
    'only a text layer takes this — canvas.state answers "layers" with each one\'s "kind"',
  )
}

function locks(input: Record<string, unknown>): ActionOutcome {
  return editLayer(
    input,
    layer => {
      const named = LOCK_KEYS.filter(padlock => input[padlock] !== undefined)
      // A call naming no padlock at all is a refusal, which `run` makes of an empty list.
      if (named.length === 0) return []

      const wanted = Object.fromEntries(named.map(padlock => [padlock, boolOf(input, padlock)]))
      return [setLayerLocks(layer.id, { ...layer.locked, ...wanted })]
    },
    `this call named no padlock — it takes ${LOCK_KEYS.join(', ')}`,
  )
}

function shape(input: Record<string, unknown>): ActionOutcome {
  const fill = packedColour(textOf(input, 'fill') ?? '')
  const stroke = packedColour(textOf(input, 'stroke') ?? '')
  const strokeWidth = numberOf(input, 'strokeWidth')
  const sides = numberOf(input, 'sides')
  const filled = input.filled === undefined ? null : boolOf(input, 'filled')
  const stroked = input.stroked === undefined ? null : boolOf(input, 'stroked')

  return editLayer(
    input,
    layer => {
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
    },
    'only a shape layer takes this; an open shape (line, arrow) has no inside to fill, and no shape may lose both its fill and its stroke',
  )
}

/**
 * The one dial the layer carries. A field naming another is refused rather than dropped: written
 * into the stack it would be carried, neutral and invisible, by a pass that never reads it.
 */
function adjustment(input: Record<string, unknown>): ActionOutcome {
  return editLayer(
    input,
    layer => {
      if (layer.kind !== 'adjustment') return []

      const named = ADJUSTMENT_KINDS.filter(kind => input[kind] !== undefined)
      if (named.length !== 1 || named[0] !== layer.adjustment) return []

      const value = numberOf(input, layer.adjustment)
      return value === null
        ? []
        : [setLayerAdjustment(layer.id, { ...layer.values, [layer.adjustment]: value })]
    },
    'only an adjustment layer takes this, and the one dial named must be the one it carries — canvas.state answers "adjustment" on each such layer',
  )
}

function duplicate(input: Record<string, unknown>): ActionOutcome {
  const copyId = newId()
  const outcome = editLayer(
    input,
    layer => [duplicateLayer(layer.id, copyId, textOf(input, 'name') ?? layer.name, newId)],
    'this layer built no copy',
  )

  return outcome.ok ? { ok: true, data: { layerId: copyId } } : outcome
}

function group(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_IMAGE)

  const layerIds = textsOf(input, 'layerIds')
  const name = textOf(input, 'name')
  if (layerIds.length === 0 || name === null)
    return refused('badInput', '"layerIds" wants at least one layer, and "name" is required')

  // Top level only, which is all `groupLayers` gathers: an id that names nothing, or one that sits
  // INSIDE a group, would otherwise be dropped in silence and the group answered for regardless.
  // By id OR by NAME, as every other layer gesture: a name read out of `canvas.state` was answered
  // « not at the top of the stack », which blames the stack for a lookup that never happened.
  const top = new Set(open.state.layers.map(layer => layer.id))
  const aimed = layerIds.map(given => layerAimed(open.state, given))
  const outside = layerIds.filter((_, at) => {
    const layer = aimed[at]
    return layer === undefined || !top.has(layer.id)
  })
  if (outside.length > 0)
    return refused(
      'notFound',
      `only layers at the top of the stack can be grouped, and ${outside.join(', ')} is not one — canvas.state answers "layers" with their ids and names`,
    )

  const groupId = newId()
  const outcome = run(
    open.documentId,
    [
      groupLayers(
        aimed.flatMap(layer => (layer ? [layer.id] : [])),
        groupId,
        name,
      ),
    ],
    'those layers built no group',
  )
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
  if (!open) return refused('wrongSurface', NO_IMAGE)

  const named = textOf(input, 'layerId')
  const layer = layerAimed(open.state, named)
  if (!layer) return refused('notFound', noLayer(named))

  // Not a command: arming a layer is a way of looking at the stack, not an edit of it.
  selectLayerIn(open.documentId, layer.id)
  return { ok: true }
}

function resize(input: Record<string, unknown>): ActionOutcome {
  const width = numberOf(input, 'width')
  const height = numberOf(input, 'height')
  if (width === null || height === null)
    return refused('badInput', '"width" and "height" are both wanted, in pixels')

  return edit(
    () => [
      boolOf(input, 'scalePixels')
        ? resizeImage(width, height)
        : resizeCanvas(width, height, { x: 0, y: 0 }),
    ],
    'this size built no resize',
  )
}

function crop(input: Record<string, unknown>): ActionOutcome {
  const x = numberOf(input, 'x')
  const y = numberOf(input, 'y')
  const width = numberOf(input, 'width')
  const height = numberOf(input, 'height')
  if (x === null || y === null || width === null || height === null)
    return refused('badInput', '"x", "y", "width" and "height" are all wanted, in pixels')

  return edit(() => [cropToRect({ x, y, width, height })], 'this rectangle built no crop')
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
  if (remove && named)
    return refused(
      'badInput',
      '"remove" cannot travel with "enabled" or "linked" — take the mask off in one call, set what it does in another',
    )

  return editLayer(
    input,
    layer => {
      if (!layer.mask || (!remove && !named)) return []

      return [
        setLayerMask(
          layer.id,
          remove
            ? undefined
            : {
                enabled:
                  input.enabled === undefined ? layer.mask.enabled : boolOf(input, 'enabled'),
                linked: input.linked === undefined ? layer.mask.linked : boolOf(input, 'linked'),
              },
        ),
      ]
    },
    'this layer wears no mask, or the call named none of remove, enabled, linked — canvas.state answers "mask" on the layers that carry one, and a mask is carved from a selection in the app',
  )
}

/** The guide named, so an id nobody answers to is a refusal rather than a command that writes
 * nothing. */
function editGuide(
  input: Record<string, unknown>,
  build: (guide: Guide) => Commands,
  nothing: string,
): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_IMAGE)

  const named = textOf(input, 'guideId') ?? ''
  const guide = open.state.guides.find(held => held.id === named)
  return guide
    ? run(open.documentId, build(guide), nothing)
    : refused(
        'notFound',
        `no guide "${named}" in the image in front — canvas.state answers "guides" with their ids`,
      )
}

/**
 * The document's grid, set in CELLS. Without a count only the mode changes; with one the document
 * is resized to `columns × cell` so the artwork measures what was asked for.
 *
 * 🛑 A resize drops the pixel history: a patch names its rectangle in its own surface's
 * coordinates, and `resurface` cannot carry those. Said in the action's description too.
 */
function setPixelArt(input: Record<string, unknown>): ActionOutcome {
  const enabled = boolOf(input, 'enabled')
  const cell = numberOf(input, 'cell') ?? 1
  const columns = numberOf(input, 'columns')
  const rows = numberOf(input, 'rows')

  // 🛑 Both counts or neither: one alone was DROPPED and answered `ok`, so a model asking for
  // « 32 columns » got the document's own size back and then placed cells on a grid of 512.
  if ((columns === null) !== (rows === null))
    return refused('badInput', 'a grid wants "columns" AND "rows", in cells — or neither of them')

  return edit(() => {
    const sized =
      enabled && columns !== null && rows !== null
        ? [resizeCanvas(columns * cell, rows * cell, { x: 0, y: 0 })]
        : []
    return [...sized, setPixelCell(enabled ? cell : null)]
    // No sentence for « nothing happened »: the builder always hands `setPixelCell` back, so
    // `run` never reaches its empty-list refusal from here.
  }, '')
}

/** What each shape wants, said so a caller can repair its own call. */
const PIXEL_INPUT: Record<PixelShape, string> = {
  points: '"cells" wants at least one cell, each written "x,y" — for example ["3,4", "3,5"]',
  line: 'a line wants "x", "y", "toX" and "toY", in cells',
  rectangle: 'a rectangle wants "x", "y", "toX" and "toY", in cells — "filled" fills it',
  fill: 'a fill takes the whole layer, or the box named by "x", "y", "toX" and "toY"',
}

/** A cell as « x,y ». 🛑 Both halves WANTED and non-empty: `Number('')` is zero, and "3" then
 * "3," both landed on row nought — counting the commas was not enough. */
const CELL_WRITTEN = /^\s*(-?\d+)\s*,\s*(-?\d+)\s*$/

function cellsAsked(input: Record<string, unknown>): Point[] | null {
  const cells = textsOf(input, 'cells').flatMap(one => {
    const said = CELL_WRITTEN.exec(one)
    return said ? [{ x: Number(said[1]), y: Number(said[2]) }] : []
  })
  return cells.length === textsOf(input, 'cells').length ? cells : null
}

/** Which cells a shape covers, in grid coordinates. `null` when the input cannot name them. */
function shapeCells(
  shape: PixelShape,
  input: Record<string, unknown>,
  columns: number,
  rows: number,
): readonly Point[] | null {
  if (shape === 'points') return cellsAsked(input)

  const from = { x: numberOf(input, 'x'), y: numberOf(input, 'y') }
  if (shape === 'fill' && from.x === null)
    return cellsOfRect({ x: 0, y: 0 }, { x: columns - 1, y: rows - 1 }, true)
  if (from.x === null || from.y === null) return null

  const to = { x: numberOf(input, 'toX'), y: numberOf(input, 'toY') }
  if (to.x === null || to.y === null) return null

  if (shape === 'line') return cellsOfLine({ x: from.x, y: from.y }, { x: to.x, y: to.y })

  // 🛑 A FILLED box is clipped to the grid before it is walked, never after: every cell it drops
  // was going to be dropped anyway, and « fill 0 to 99 999 » then costs the document rather than
  // 264 ms of the UI thread. An OUTLINE cannot be clipped — the border would move onto the edge
  // of the grid, drawing four sides nobody asked for.
  const filled = shape === 'fill' || boolOf(input, 'filled')
  const within = (value: number, last: number): number => Math.min(Math.max(value, 0), last)
  return filled
    ? cellsOfRect(
        { x: within(from.x, columns - 1), y: within(from.y, rows - 1) },
        { x: within(to.x, columns - 1), y: within(to.y, rows - 1) },
        true,
      )
    : cellsOfRect({ x: from.x, y: from.y }, { x: to.x, y: to.y }, false)
}

function drawPixels(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface', NO_IMAGE)

  const grid = gridOf(open.state)
  if (grid === null)
    return refused(
      'badInput',
      'this image is not on a pixel grid — canvas.setPixelArt puts it on one',
    )
  const { cell, columns, rows } = grid

  const shape = oneOf(input, 'shape', PIXEL_SHAPES)
  if (!shape) return refused('badInput', `"shape" must be one of: ${PIXEL_SHAPES.join(', ')}`)

  const erase = boolOf(input, 'erase')
  const written = textOf(input, 'color')
  if (erase === (written !== null))
    return refused('badInput', 'name a "color" or ask to "erase", one of the two and not both')
  const color = erase ? null : packedColour(written ?? '')
  if (!erase && color === null)
    return refused('badInput', `"${written ?? ''}" is not a colour — write one as "#rrggbb"`)

  const asked = shapeCells(shape, input, columns, rows)
  if (asked === null || asked.length === 0) return refused('badInput', PIXEL_INPUT[shape])

  // Outside the grid is DROPPED, never folded back: a cell at 40 on a grid of 32 is a mistake,
  // and painting it at 8 would answer a request nobody made.
  const inside = asked.filter(at => at.x >= 0 && at.y >= 0 && at.x < columns && at.y < rows)
  if (inside.length === 0)
    return refused('badInput', `no cell of that lands on a grid of ${columns} by ${rows}`)

  // By id OR by name, as `editLayer` twenty lines up: `canvas.state` answers both, and a model
  // that copied the NAME out of it was told the layer did not exist.
  const named = textOf(input, 'layerId')
  const layer = layerAimed(open.state, named)
  if (named !== null && !layer) return refused('notFound', noLayer(named))

  const painted = canvasHost(open.documentId)?.paintCells(
    layer?.id ?? null,
    inside.map(at => cellRect(at, cell)),
    color,
  )
  return painted
    ? { ok: true }
    : refused(
        'notFound',
        'nothing was painted: no such layer, or it is a group, or its pixels are padlocked, or it is a caption or a shape, or the cells fall outside the selection',
      )
}

export const CANVAS_HANDLERS: ActionHandlers = {
  'canvas.state': readState,
  'canvas.resize': resize,
  'canvas.setPixelArt': setPixelArt,
  'canvas.drawPixels': drawPixels,
  'canvas.crop': crop,
  'canvas.flipOrRotate': input => {
    const turn = TURNS[textOf(input, 'turn') ?? '']
    return turn
      ? edit((_state, documentId) => [turn(documentId)], 'that turn built no command')
      : refused('badInput', `"turn" wants one of: ${Object.keys(TURNS).join(', ')}`)
  },
  'layer.add': newLayer,
  'layer.remove': input =>
    editLayer(input, layer => [removeLayer(layer.id)], 'that layer built no removal'),
  'layer.select': selectLayer,
  'layer.rename': input => {
    const name = textOf(input, 'name')
    return name === null
      ? refused('badInput', '"name" is required — the new name of the layer')
      : editLayer(input, layer => [renameLayer(layer.id, name)], 'that layer built no rename')
  },
  'layer.setOpacityBlendAndVisibility': style,
  'layer.lock': locks,
  'layer.editShapeLayer': shape,
  'layer.setAdjustmentAmount': adjustment,
  'layer.transform': transform,
  'layer.editTextLayer': text,
  'layer.reorderInStack': input => {
    const index = numberOf(input, 'index')
    if (index === null)
      return refused(
        'badInput',
        '"index" is required — the place among the new siblings, counted from 0',
      )

    const parentId = textOf(input, 'parentId')
    // `moveLayer` refuses a parent that is not a group, the layer itself, or one of its own
    // descendants by handing the state back untouched — all three would read as done.
    return editLayer(
      input,
      (layer, state) =>
        canMoveLayer(state, layer.id, parentId) ? [moveLayer(layer.id, parentId, index)] : [],
      '"parentId" must name a group that is neither this layer nor one of its own children — canvas.state answers "layers" with each one\'s "kind"',
    )
  },
  'layer.duplicate': duplicate,
  'layer.group': group,
  'layer.ungroup': input =>
    editLayer(input, layer => [ungroupLayer(layer.id)], 'that layer built no ungroup'),
  'layer.mergeDown': input =>
    editLayer(input, layer => [mergeDown(layer.id)], 'that layer built no merge'),
  'layer.setMaskOptions': mask,

  'guide.add': input => {
    const open = mounted()
    const axis = oneOf(input, 'axis', GUIDE_AXES)
    if (!open) return refused('wrongSurface', NO_IMAGE)
    if (!axis) return refused('badInput', `"axis" wants one of: ${GUIDE_AXES.join(', ')}`)

    const guide = { id: newId(), axis, position: numberOf(input, 'position') ?? 0 }
    const outcome = run(open.documentId, [addGuide(guide)], 'that guide built no command')
    return outcome.ok ? { ok: true, data: { guideId: guide.id } } : outcome
  },

  'guide.move': input =>
    editGuide(
      input,
      guide => [moveGuide(guide.id, numberOf(input, 'position') ?? guide.position)],
      'that guide built no move',
    ),

  'guide.remove': input =>
    editGuide(input, guide => [removeGuide(guide.id)], 'that guide built no removal'),
}
