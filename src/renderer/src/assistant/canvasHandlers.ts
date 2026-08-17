import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { packedColour } from '@shared/domain/color'
import { toRadians } from '@shared/domain/angles'
import {
  ADJUSTMENT_KINDS,
  BLEND_MODES,
  adjustmentLayer,
  allLayers,
  layerById,
  pixelLayer,
  textLayer,
  type CanvasState,
  type Layer,
} from '@/engines/canvas/canvasState'
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
  return layer ? run(open.documentId, build(layer, open.state)) : refused('badInput')
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
        ...(layer.kind === 'text' ? { text: layer.text, size: layer.size } : {}),
        ...(layer.kind === 'adjustment' ? { adjustment: layer.adjustment } : {}),
      })),
    },
  }
}

function born(input: Record<string, unknown>, id: string, name: string): Layer | null {
  switch (oneOf(input, 'kind', ['pixel', 'text', 'adjustment'])) {
    case 'pixel':
      return pixelLayer(id, name)
    case 'text':
      return textLayer(id, textOf(input, 'text') ?? name, {
        x: numberOf(input, 'x') ?? 0,
        y: numberOf(input, 'y') ?? 0,
      })
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

  return editLayer(input, layer =>
    // The command only touches a text layer, so a pixel layer named here would be reported as
    // done while nothing changed.
    layer.kind === 'text'
      ? [
          setLayerText(layer.id, {
            ...(written === null ? {} : { text: written }),
            ...(size === null ? {} : { size }),
            ...(colour === null ? {} : { color: colour }),
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
  const layerIds = textsOf(input, 'layerIds')
  const name = textOf(input, 'name')
  if (layerIds.length === 0 || name === null) return refused('badInput')

  const groupId = newId()
  const outcome = edit(() => [groupLayers(layerIds, groupId, name)])
  return outcome.ok ? { ok: true, data: { layerId: groupId } } : outcome
}

function select(input: Record<string, unknown>): ActionOutcome {
  const open = mounted()
  if (!open) return refused('wrongSurface')

  const layer = layerById(open.state, textOf(input, 'layerId'))
  if (!layer) return refused('badInput')

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
    return index === null
      ? refused('badInput')
      : editLayer(input, layer => [moveLayer(layer.id, textOf(input, 'parentId'), index)])
  },
  'layer.duplicate': duplicate,
  'layer.group': group,
  'layer.ungroup': input => editLayer(input, layer => [ungroupLayer(layer.id)]),
  'layer.mergeDown': input => editLayer(input, layer => [mergeDown(layer.id)]),
}
