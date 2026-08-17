import type { ActionOutcome, ActionRefusal } from '@shared/domain/assistant'
import {
  ADJUSTMENT_KINDS,
  BLEND_MODES,
  adjustmentLayer,
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
 * run, so an edit made from outside undoes exactly like an edit made with the mouse. The stack
 * belongs to the image tab in front; naming a document here would be a second way of saying
 * which one, beside `document.activate`.
 */

const refused = (refusal: ActionRefusal): ActionOutcome => ({ ok: false, refusal })

/** The image in front, or nothing — which reads as `wrongSurface`, as a command would. */
function imageId(): string | null {
  return activeImageId(useDocuments.getState())
}

function stateOf(documentId: string): CanvasState {
  return canvasOf(useCanvases.getState(), documentId)
}

function layersOf(layers: readonly Layer[]): Layer[] {
  return layers.flatMap(layer =>
    layer.kind === 'group' ? [layer, ...layersOf(layer.children)] : [layer],
  )
}

function findLayer(documentId: string, layerId: string): Layer | null {
  return layersOf(stateOf(documentId).layers).find(layer => layer.id === layerId) ?? null
}

/**
 * Runs commands against the image in front, having checked the layer they name exists.
 *
 * The check is the point: a command whose layer is gone answers by returning the state
 * untouched, so without it every miss would be reported as done — the defect `wrongSurface`
 * exists to prevent, one level down.
 */
function edit(
  layerId: string | null,
  build: (documentId: string) => readonly Command<CanvasState>[],
): ActionOutcome {
  const documentId = imageId()
  if (!documentId) return refused('wrongSurface')
  if (layerId !== null && !findLayer(documentId, layerId)) return refused('badInput')

  const commands = build(documentId)
  if (commands.length === 0) return refused('badInput')

  /**
   * One entry per command, deliberately — NOT wrapped in a gesture. Coalescing only merges
   * commands sharing an `id`, so a gesture around three different dials would leave three
   * entries anyway, and the first command's `revert` is the one it would keep: undoing would put
   * back the opacity and leave the blend mode where the call had set it.
   */
  const store = useCanvases.getState()
  for (const command of commands) store.runCommand(documentId, command)

  return { ok: true }
}

function readState(): ActionOutcome {
  const documentId = imageId()
  if (!documentId) return refused('wrongSurface')

  const state = stateOf(documentId)
  return {
    ok: true,
    data: {
      documentId,
      width: state.width,
      height: state.height,
      dpi: state.dpi,
      activeLayerId: state.activeLayerId,
      guides: state.guides,
      // Flattened, each with the group it sits in: a client that has to walk a tree to find a
      // layer id would walk it wrong the first time a group was collapsed.
      layers: layersOf(state.layers).map(layer => ({
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

function newLayer(input: Record<string, unknown>): ActionOutcome {
  const name = textOf(input, 'name')
  const kind = oneOf(input, 'kind', ['pixel', 'text', 'adjustment'])
  if (name === null || !kind) return refused('badInput')

  const id = newId()
  const at = { x: numberOf(input, 'x') ?? 0, y: numberOf(input, 'y') ?? 0 }

  const built = (): Layer | null => {
    if (kind === 'pixel') return pixelLayer(id, name)
    if (kind === 'text') return textLayer(id, textOf(input, 'text') ?? name, at)

    const adjustment = oneOf(input, 'adjustment', ADJUSTMENT_KINDS)
    return adjustment ? adjustmentLayer(id, name, adjustment) : null
  }

  const layer = built()
  // An adjustment layer with no dial named would be a row in the panel that changes nothing,
  // which is the one thing a layer must never be.
  if (!layer) return refused('badInput')

  const outcome = edit(null, () => [addLayer(layer)])
  return outcome.ok ? { ok: true, data: { layerId: id } } : outcome
}

function style(input: Record<string, unknown>): ActionOutcome {
  const layerId = textOf(input, 'layerId')
  if (layerId === null) return refused('badInput')

  const opacity = numberOf(input, 'opacity')
  const fillOpacity = numberOf(input, 'fillOpacity')
  const blend = oneOf(input, 'blend', BLEND_MODES)

  return edit(layerId, () => [
    ...(opacity === null ? [] : [setLayerOpacity(layerId, opacity)]),
    ...(fillOpacity === null ? [] : [setLayerFillOpacity(layerId, fillOpacity)]),
    ...(blend ? [setLayerBlend(layerId, blend)] : []),
    ...(input.visible === undefined ? [] : [setLayerVisible(layerId, boolOf(input, 'visible'))]),
    ...(input.clipped === undefined ? [] : [setLayerClipped(layerId, boolOf(input, 'clipped'))]),
  ])
}

function transform(input: Record<string, unknown>): ActionOutcome {
  const layerId = textOf(input, 'layerId')
  const documentId = imageId()
  if (layerId === null) return refused('badInput')
  if (!documentId) return refused('wrongSurface')

  const current = findLayer(documentId, layerId)?.transform
  if (!current) return refused('badInput')

  const degrees = numberOf(input, 'rotation')
  return edit(layerId, () => [
    setLayerTransform(layerId, {
      ...current,
      x: numberOf(input, 'x') ?? current.x,
      y: numberOf(input, 'y') ?? current.y,
      scaleX: numberOf(input, 'scaleX') ?? current.scaleX,
      scaleY: numberOf(input, 'scaleY') ?? current.scaleY,
      // Degrees in, radians stored: a client writing 90 for a quarter turn is right more often
      // than one writing 1.5707963.
      rotation: degrees === null ? current.rotation : (degrees * Math.PI) / 180,
    }),
  ])
}

function text(input: Record<string, unknown>): ActionOutcome {
  const layerId = textOf(input, 'layerId')
  const documentId = imageId()
  if (layerId === null) return refused('badInput')
  if (!documentId) return refused('wrongSurface')

  // The command only touches a text layer, so a pixel layer named here would be reported as
  // done while nothing changed.
  if (findLayer(documentId, layerId)?.kind !== 'text') return refused('badInput')

  const colour = textOf(input, 'color')
  const packed = colour === null ? null : Number.parseInt(colour.replace('#', ''), 16)
  if (packed !== null && !Number.isFinite(packed)) return refused('badInput')

  const size = numberOf(input, 'size')
  const written = textOf(input, 'text')

  return edit(layerId, () => [
    setLayerText(layerId, {
      ...(written === null ? {} : { text: written }),
      ...(size === null ? {} : { size }),
      ...(packed === null ? {} : { color: packed }),
    }),
  ])
}

function move(input: Record<string, unknown>): ActionOutcome {
  const layerId = textOf(input, 'layerId')
  const index = numberOf(input, 'index')
  if (layerId === null || index === null) return refused('badInput')

  return edit(layerId, () => [moveLayer(layerId, textOf(input, 'parentId'), index)])
}

function duplicate(input: Record<string, unknown>): ActionOutcome {
  const layerId = textOf(input, 'layerId')
  const documentId = imageId()
  if (layerId === null) return refused('badInput')
  if (!documentId) return refused('wrongSurface')

  const source = findLayer(documentId, layerId)
  if (!source) return refused('badInput')

  const copyId = newId()
  const outcome = edit(layerId, () => [
    duplicateLayer(layerId, copyId, textOf(input, 'name') ?? source.name, newId),
  ])
  return outcome.ok ? { ok: true, data: { layerId: copyId } } : outcome
}

function group(input: Record<string, unknown>): ActionOutcome {
  const layerIds = textsOf(input, 'layerIds')
  const name = textOf(input, 'name')
  if (layerIds.length === 0 || name === null) return refused('badInput')

  const groupId = newId()
  const outcome = edit(null, () => [groupLayers(layerIds, groupId, name)])
  return outcome.ok ? { ok: true, data: { layerId: groupId } } : outcome
}

function select(input: Record<string, unknown>): ActionOutcome {
  const layerId = textOf(input, 'layerId')
  const documentId = imageId()
  if (!documentId) return refused('wrongSurface')
  if (layerId === null || !findLayer(documentId, layerId)) return refused('badInput')

  // Not a command: arming a layer is a way of looking at the stack, not an edit of it, so it
  // adds no history entry — see `selectLayerIn`.
  selectLayerIn(documentId, layerId)
  return { ok: true }
}

function resize(input: Record<string, unknown>): ActionOutcome {
  const width = numberOf(input, 'width')
  const height = numberOf(input, 'height')
  if (width === null || height === null) return refused('badInput')

  return edit(null, () => [
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

  return edit(null, () => [cropToRect({ x, y, width, height })])
}

function orient(input: Record<string, unknown>): ActionOutcome {
  const turn = oneOf(input, 'turn', [
    'flipHorizontal',
    'flipVertical',
    'rotateClockwise',
    'rotateAnticlockwise',
  ])
  if (!turn) return refused('badInput')

  return edit(null, () => [
    turn === 'flipHorizontal'
      ? flipImage('horizontal')
      : turn === 'flipVertical'
        ? flipImage('vertical')
        : rotateImage(turn === 'rotateClockwise'),
  ])
}

export const CANVAS_HANDLERS: ActionHandlers = {
  'canvas.state': readState,
  'canvas.resize': resize,
  'canvas.crop': crop,
  'canvas.orient': orient,
  'layer.add': newLayer,
  'layer.remove': input => {
    const layerId = textOf(input, 'layerId')
    return layerId === null ? refused('badInput') : edit(layerId, () => [removeLayer(layerId)])
  },
  'layer.select': select,
  'layer.rename': input => {
    const layerId = textOf(input, 'layerId')
    const name = textOf(input, 'name')
    return layerId === null || name === null
      ? refused('badInput')
      : edit(layerId, () => [renameLayer(layerId, name)])
  },
  'layer.style': style,
  'layer.transform': transform,
  'layer.text': text,
  'layer.move': move,
  'layer.duplicate': duplicate,
  'layer.group': group,
  'layer.ungroup': input => {
    const layerId = textOf(input, 'layerId')
    return layerId === null ? refused('badInput') : edit(layerId, () => [ungroupLayer(layerId)])
  },
  'layer.mergeDown': input => {
    const layerId = textOf(input, 'layerId')
    return layerId === null ? refused('badInput') : edit(layerId, () => [mergeDown(layerId)])
  },
}
