import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { aimedAt, type Target } from '@shared/domain/target'
import {
  type LayerLocks,
  type Transform as LayerTransform,
  allLayers,
  canMoveLayer,
  layerById,
  GUIDE_AXES,
  type CanvasState,
  type Guide,
  type Layer,
} from '@/engines/canvas/canvasState'
import { gridOf } from '@/engines/canvas/pixelGrid'
import {
  addGuide,
  cropToRect,
  flipImage,
  mergeDown,
  moveGuide,
  moveLayer,
  removeGuide,
  removeLayer,
  renameLayer,
  resizeCanvas,
  resizeImage,
  rotateImage,
  setLayerMask,
  ungroupLayer,
} from '@/engines/canvas/commands'
import type { Command } from '@/engines/core/history'
import { newId } from '@/helpers/ids'
import { turnPort } from '@/features/image/turnPort'
import { canvasOf, selectLayerIn, useCanvases } from '@/stores/canvases'
import { activeImageId, useDocuments } from '@/stores/documents'
import type { ActionHandlers } from './actionHandler'
import { boolOf, numberOf, oneOf, textOf } from './actionInputs'
import { CANVAS_LAYER_HANDLERS } from './canvasLayerHandlers'
import { CANVAS_PIXEL_HANDLERS } from './canvasPixelHandlers'

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
export const CANVAS_HANDLERS: ActionHandlers = {
  ...CANVAS_LAYER_HANDLERS,
  ...CANVAS_PIXEL_HANDLERS,
  'canvas.state': readState,
  'canvas.resize': resize,
  'canvas.crop': crop,
  'canvas.flipOrRotate': input => {
    const turn = TURNS[textOf(input, 'turn') ?? '']
    return turn
      ? edit((_state, documentId) => [turn(documentId)], 'that turn built no command')
      : refused('badInput', `"turn" wants one of: ${Object.keys(TURNS).join(', ')}`)
  },
  'layer.remove': input =>
    editLayer(input, layer => [removeLayer(layer.id)], 'that layer built no removal'),
  'layer.select': selectLayer,
  'layer.rename': input => {
    const name = textOf(input, 'name')
    return name === null
      ? refused('badInput', '"name" is required — the new name of the layer')
      : editLayer(input, layer => [renameLayer(layer.id, name)], 'that layer built no rename')
  },
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
