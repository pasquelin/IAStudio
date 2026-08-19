import type { AdjustmentStack } from '@shared/domain/adjustments'
import type { BlendMode } from '@shared/domain/canvasBlend'
import { clamp } from '@shared/numeric'
import type { Command } from '../core/history'
import {
  allLayers,
  canMoveLayer,
  canRemoveLayer,
  clampOpacity,
  DEFAULT_CANVAS,
  groupLayer,
  isGroup,
  layerById,
  mapLayers,
  pixelLayer,
  updateSiblings,
  type CanvasState,
  type Guide,
  type Layer,
  type LayerLocks,
  type Rect,
  type TextLayer,
  type Transform,
} from './canvasState'

/**
 * Layer edits, on the same Command model as the scene ones. `engines/core/history` runs them —
 * it is generic and shared, never duplicated per engine.
 *
 * A command captures what it needs to revert as it is applied, not as it is built.
 */
export function addLayer(layer: Layer): Command<CanvasState> {
  return {
    id: `layer:add:${layer.id}`,
    apply: state => ({
      ...state,
      layers: [...state.layers, layer],
      activeLayerId: layer.id,
    }),
    revert: state => withoutLayer(state, layer.id),
  }
}

export function removeLayer(id: string): Command<CanvasState> {
  // Restructuring: removing a group takes its whole subtree, which no field-by-field inverse
  // would put back at the right depth.
  return restructure(`layer:remove:${id}`, state => {
    const target = layerById(state, id)
    if (!target) return state

    // A document with an empty stack cannot be painted on — and a GROUP carries its subtree out
    // with it, so what matters is what stays, not how many layers the document has. See
    // `canRemoveLayer`, which the panel reads to grey the same gesture.
    if (!canRemoveLayer(state.layers, target)) return state

    return withoutLayer(state, id)
  })
}

/**
 * Removing the active layer moves the selection to a neighbour, never leaves it dangling —
 * checked against what survives, not against the id removed: taking a group takes its children
 * with it, and one of those may be the armed one.
 */
function withoutLayer(state: CanvasState, id: string): CanvasState {
  const index = allLayers(state.layers).findIndex(layer => layer.id === id)
  const layers = mapLayers(state.layers, layer => (layer.id === id ? null : layer))

  const remaining = allLayers(layers).filter(layer => !isGroup(layer))
  if (remaining.some(layer => layer.id === state.activeLayerId)) return { ...state, layers }

  const neighbour = remaining[Math.min(index, remaining.length - 1)]
  return { ...state, layers, activeLayerId: neighbour?.id ?? null }
}

/**
 * Anywhere in the tree: `parentId` names the group receiving the layer, `null` the root, and
 * `index` its place among that level's layers once the moved one has left — bottom first, the
 * order the stack is drawn in, which the panel reverses on its way to the eye.
 *
 * A group refuses to enter its own subtree. The drop would carry the receiving group along with
 * it, and every layer under it would leave the document with no way back.
 */
export function moveLayer(
  id: string,
  parentId: string | null,
  index: number,
): Command<CanvasState> {
  return restructure(`layer:move:${id}`, state => {
    const layer = layerById(state, id)
    if (!layer || !canMoveLayer(state, id, parentId)) return state

    const without = mapLayers(state.layers, current => (current.id === id ? null : current))
    if (parentId === null) return { ...state, layers: insertedAt(without, layer, index) }

    return {
      ...state,
      layers: mapLayers(without, current =>
        current.id === parentId && isGroup(current)
          ? { ...current, children: insertedAt(current.children, layer, index) }
          : current,
      ),
    }
  })
}

export function setLayerBlend(id: string, blend: BlendMode): Command<CanvasState> {
  return patch(`layer:blend:${id}`, id, { blend })
}

export function setLayerLocks(id: string, locks: LayerLocks): Command<CanvasState> {
  return patch(`layer:locks:${id}`, id, { locked: locks })
}

export function setLayerFillOpacity(id: string, fillOpacity: number): Command<CanvasState> {
  return patch(`layer:fill-opacity:${id}`, id, { fillOpacity: clampOpacity(fillOpacity) })
}

export function setLayerClipped(id: string, clipped: boolean): Command<CanvasState> {
  return patch(`layer:clip:${id}`, id, { clipped })
}

// Clamped rather than passed to `splice` as it comes: a negative index counts from the end there,
// so a drop above the first row would land at the top of the stack instead of the bottom.
function insertedAt(siblings: readonly Layer[], layer: Layer, index: number): Layer[] {
  const layers = [...siblings]
  layers.splice(clamp(index, 0, layers.length), 0, layer)
  return layers
}

export function setLayerOpacity(id: string, opacity: number): Command<CanvasState> {
  return patch(`layer:opacity:${id}`, id, { opacity: clampOpacity(opacity) })
}

export function setLayerVisible(id: string, visible: boolean): Command<CanvasState> {
  return patch(`layer:visible:${id}`, id, { visible })
}

export function renameLayer(id: string, name: string): Command<CanvasState> {
  return patch(`layer:rename:${id}`, id, { name })
}

/**
 * Gives a layer a mask, or takes it away. Its pixels belong to the engine like the layer's own;
 * what the stack records is only that there is one, and whether it is hiding anything.
 */
export function setLayerMask(
  id: string,
  mask: { enabled: boolean; linked: boolean } | undefined,
): Command<CanvasState> {
  return patch(`layer:mask:${id}`, id, { mask })
}

/**
 * The grading values of an adjustment layer. Typed apart from `patch`, which is spelled on the
 * fields every kind shares — this one belongs to a single kind of layer.
 */
export function setLayerAdjustment(id: string, values: AdjustmentStack): Command<CanvasState> {
  let previous: AdjustmentStack | null = null

  return {
    id: `layer:adjust:${id}`,
    apply: state => ({
      ...state,
      layers: mapLayers(state.layers, layer => {
        if (layer.id !== id || layer.kind !== 'adjustment') return layer
        previous ??= layer.values
        return { ...layer, values }
      }),
    }),
    revert: state => ({
      ...state,
      layers: mapLayers(state.layers, layer =>
        layer.id === id && layer.kind === 'adjustment' && previous
          ? { ...layer, values: previous }
          : layer,
      ),
    }),
  }
}

/** The words of a caption, and how they are set. Its own command, like the grading values. */
export function setLayerText(
  id: string,
  changes: Partial<Pick<TextLayer, 'text' | 'font' | 'size' | 'color'>>,
): Command<CanvasState> {
  let previous: TextLayer | null = null

  return {
    id: `layer:text:${id}`,
    apply: state => ({
      ...state,
      layers: mapLayers(state.layers, layer => {
        if (layer.id !== id || layer.kind !== 'text') return layer
        previous ??= layer
        return { ...layer, ...changes }
      }),
    }),
    revert: state => ({
      ...state,
      layers: mapLayers(state.layers, layer => (layer.id === id && previous ? previous : layer)),
    }),
  }
}

/** The whole transform at once: the inspector's fields all write into the same object. */
export function setLayerTransform(id: string, transform: Transform): Command<CanvasState> {
  return patch(`layer:transform:${id}`, id, { transform })
}

/**
 * One shape for every single-field edit: they all revert by putting the old value back. Typed on
 * the fields shared by every kind, so a patch cannot turn a group into something else.
 */
function patch(
  commandId: string,
  id: string,
  fields: Partial<Omit<Layer, 'kind'>>,
): Command<CanvasState> {
  let previous: Layer | null = null

  return {
    id: commandId,
    apply: state => {
      previous = allLayers(state.layers).find(layer => layer.id === id) ?? null
      return mapLayer(state, id, layer => ({ ...layer, ...fields }))
    },
    revert: state => (previous ? mapLayer(state, id, () => previous ?? undefined) : state),
  }
}

function mapLayer(
  state: CanvasState,
  id: string,
  change: (layer: Layer) => Layer | undefined,
): CanvasState {
  return {
    ...state,
    layers: mapLayers(state.layers, layer => (layer.id === id ? (change(layer) ?? layer) : layer)),
  }
}

/**
 * Where the moved layer ends up, as an absolute position rather than a step: commands merged
 * into one gesture keep the first one's `revert` and the last one's `apply`, so a relative one
 * would rewind a single pointer move.
 */
export function translateLayer(id: string, x: number, y: number): Command<CanvasState> {
  let previous: Transform | null = null

  return {
    id: `layer:translate:${id}`,
    apply: state => {
      const target = layerById(state, id)
      if (!target) return state
      previous = target.transform
      return mapLayer(state, id, layer => ({ ...layer, transform: { ...layer.transform, x, y } }))
    },
    revert: state =>
      previous
        ? mapLayer(state, id, layer => ({ ...layer, transform: previous ?? layer.transform }))
        : state,
  }
}

/** What the engine will be asked to paint back when this entry is stepped over. */
export type PixelPort = {
  /** `false` when the patch has been thrown away, and the entry can no longer be replayed. */
  restore: (patchId: string, side: 'before' | 'after') => boolean
}

/**
 * A stroke, as far as the history is concerned. The pixels are not in the state and never will
 * be — the engine kept the tiles either side of the gesture, and this only tells it which way to
 * replay them.
 */
export function paintPixels(patchId: string, port: PixelPort): Command<CanvasState> {
  // The layer already holds the "after" pixels when the entry is pushed; blitting them back on
  // that first apply would be a GPU pass for a texture that is already right.
  let recorded = true

  return {
    id: `pixels:${patchId}`,
    apply: state => {
      if (recorded) recorded = false
      else port.restore(patchId, 'after')
      return state
    },
    revert: state => {
      port.restore(patchId, 'before')
      return state
    },
  }
}

/**
 * Idempotent on purpose: pulling a guide off a ruler and dragging it is one gesture, and the
 * commands it emits coalesce on this id. A second one has to move the guide it already laid
 * down, not stack another beside it.
 */
export function addGuide(guide: Guide): Command<CanvasState> {
  let replaced: Guide | null = null

  return {
    id: `guide:add:${guide.id}`,
    apply: state => {
      // Applied over a guide that already carries this id, the inverse is a move back, not a
      // removal — and one gesture reaching this branch is enough to lose a guide on ⌘Z.
      replaced = state.guides.find(other => other.id === guide.id) ?? null
      return { ...state, guides: [...withoutGuide(state.guides, guide.id), guide] }
    },
    revert: state => {
      const rest = withoutGuide(state.guides, guide.id)
      return { ...state, guides: replaced ? [...rest, replaced] : rest }
    },
  }
}

function withoutGuide(guides: readonly Guide[], id: string): Guide[] {
  return guides.filter(guide => guide.id !== id)
}

/** Dragging a guide is one gesture, so the commands it emits coalesce on this id. */
export function moveGuide(id: string, position: number): Command<CanvasState> {
  let previous: number | null = null

  return {
    id: `guide:move:${id}`,
    apply: state => {
      previous = state.guides.find(guide => guide.id === id)?.position ?? null
      return withGuide(state, id, position)
    },
    revert: state => (previous === null ? state : withGuide(state, id, previous)),
  }
}

function withGuide(state: CanvasState, id: string, position: number): CanvasState {
  return {
    ...state,
    guides: state.guides.map(guide => (guide.id === id ? { ...guide, position } : guide)),
  }
}

/** Dropping a guide back on its ruler removes it, which is how every editor deletes one. */
export function removeGuide(id: string): Command<CanvasState> {
  let previous: Guide | null = null
  let index = 0

  return {
    id: `guide:remove:${id}`,
    apply: state => {
      index = state.guides.findIndex(guide => guide.id === id)
      previous = state.guides[index] ?? null
      return { ...state, guides: withoutGuide(state.guides, id) }
    },
    // Back where it was, not on top: the stack of guides has an order, and undo must be an
    // inverse, not an approximation.
    revert: state =>
      previous === null
        ? state
        : {
            ...state,
            guides: [...state.guides.slice(0, index), previous, ...state.guides.slice(index)],
          },
  }
}

export function clearGuides(): Command<CanvasState> {
  let previous: readonly Guide[] = []

  return {
    id: 'guide:clear',
    apply: state => {
      previous = state.guides
      return { ...state, guides: [] }
    },
    revert: state => ({ ...state, guides: [...previous] }),
  }
}

/**
 * Folds a group, or opens it. Adds no history entry, like the selection — though an undo of the
 * edit before it does put the fold back, since a command reverts the whole layer it patched.
 */
export function collapseLayer(state: CanvasState, id: string, collapsed: boolean): CanvasState {
  return {
    ...state,
    layers: mapLayers(state.layers, layer =>
      layer.id === id && isGroup(layer) ? { ...layer, collapsed } : layer,
    ),
  }
}

/** Selection stays out of the history: nobody wants ⌘Z to give them back a selected layer. */
export function selectLayer(state: CanvasState, id: string | null): CanvasState {
  return { ...state, activeLayerId: id }
}

/**
 * Restructuring commands — grouping, merging, flattening — revert by putting the stack back.
 *
 * A stack is metadata: ids, names, opacities. The pixels are not in it, they live in the
 * engine's textures, so this is not the full-snapshot history CLAUDE.md forbids. Inverting a
 * regroup by hand would mean rebuilding a tree from a path, and getting it subtly wrong.
 */
function restructure(
  commandId: string,
  change: (state: CanvasState) => CanvasState,
): Command<CanvasState> {
  let before: CanvasState | null = null

  return {
    id: commandId,
    apply: state => {
      before = state
      return change(state)
    },
    revert: () => before ?? DEFAULT_CANVAS,
  }
}

/**
 * Wraps the named layers in a group, at the position of the topmost of them. Selecting layers
 * that are not siblings would silently pull them out of their groups, so only top-level ones
 * are taken — the panel offers nothing else.
 */
export function groupLayers(
  ids: readonly string[],
  groupId: string,
  name: string,
): Command<CanvasState> {
  const wanted = new Set(ids)

  return restructure(`layer:group:${groupId}`, state => {
    // Top level only: a group moves whole, and pulling siblings out of one silently would be
    // a restructure nobody asked for. The panel offers nothing else.
    const members = state.layers.filter(layer => wanted.has(layer.id))
    if (members.length === 0) return state

    const last = state.layers.findLastIndex(layer => wanted.has(layer.id))
    const rest = state.layers.filter(layer => !wanted.has(layer.id))
    const group = groupLayer(groupId, name, members)

    // Where the topmost member was, counted among the layers that stay: the group must not jump
    // above what used to cover it.
    const at = state.layers.slice(0, last).filter(layer => !wanted.has(layer.id)).length
    return {
      ...state,
      layers: [...rest.slice(0, at), group, ...rest.slice(at)],
      // The topmost member, not the group: a group holds no pixels, so arming one leaves the
      // brush silently drawing nothing.
      activeLayerId: allLayers(members).findLast(layer => !isGroup(layer))?.id ?? null,
    }
  })
}

/** Dissolves a group, leaving its children where it stood. */
export function ungroupLayer(id: string): Command<CanvasState> {
  return restructure(`layer:ungroup:${id}`, state => {
    const group = layerById(state, id)
    if (!group || !isGroup(group)) return state

    const layers = updateSiblings(state.layers, id, (siblings, index) => [
      ...siblings.slice(0, index),
      ...group.children,
      ...siblings.slice(index + 1),
    ])
    const armed = allLayers(group.children).findLast(layer => !isGroup(layer))?.id
    return { ...state, layers, activeLayerId: armed ?? state.activeLayerId }
  })
}

/**
 * Merges a layer into the one below it. The pixels are the engine's to composite; what the
 * stack records is that two layers became one, keeping the lower one's name as every editor does.
 */
export function mergeDown(id: string): Command<CanvasState> {
  return restructure(`layer:merge-down:${id}`, state => {
    let merged: string | null = null

    // Within its own level: a layer merges into the one below it, not through the wall of the
    // group it sits in.
    const layers = updateSiblings(state.layers, id, (siblings, index) => {
      const below = siblings[index - 1]
      if (!below) return [...siblings]
      // The result takes the lower layer's identity, so its texture is the one kept.
      merged = below.id
      return siblings.filter((_, at) => at !== index)
    })

    return merged ? { ...state, layers, activeLayerId: merged } : state
  })
}

/** One opaque layer, named as every editor names it. Hidden layers are dropped, not merged. */
export function flatten(id: string, name: string): Command<CanvasState> {
  return restructure('layer:flatten', state => ({
    ...state,
    layers: [pixelLayer(id, name)],
    activeLayerId: id,
  }))
}

/**
 * Every id in the copy is fresh, children included. A shallow copy of a group would leave two
 * layers sharing an id — and everything downstream matches by id: one rename would rename both,
 * and `CanvasEngine` keys its textures that way, so painting one would paint the other.
 */
function copyOf(layer: Layer, id: string, name: string, newId: () => string): Layer {
  const copy = { ...layer, id, name }
  return isGroup(copy)
    ? { ...copy, children: copy.children.map(child => copyOf(child, newId(), child.name, newId)) }
    : copy
}

export function duplicateLayer(
  id: string,
  copyId: string,
  name: string,
  newId: () => string,
): Command<CanvasState> {
  return restructure(`layer:duplicate:${id}`, state => {
    const source = layerById(state, id)
    if (!source) return state

    const layers = updateSiblings(state.layers, id, (siblings, index) => {
      const next = [...siblings]
      next.splice(index + 1, 0, copyOf(source, copyId, name, newId))
      return next
    })
    return { ...state, layers, activeLayerId: copyId }
  })
}

/**
 * Moves every top-level layer, and only those: a group carries its children, so walking into it
 * would shift a nested layer once per level of nesting and tear groups away from what surrounds
 * them.
 */
function moveLayers(state: CanvasState, change: (transform: Transform) => Transform): Layer[] {
  return state.layers.map(layer => ({ ...layer, transform: change(layer.transform) }))
}

/** A frame with no surface is not a frame. */
function sided(value: number): number {
  return Math.max(1, Math.round(value))
}

/**
 * Changes the frame without touching a pixel. The layers keep their own position, so the offset
 * decides what slides out of view — this is `Canvas size`, not `Image size`.
 */
export function resizeCanvas(
  width: number,
  height: number,
  offset: { x: number; y: number },
): Command<CanvasState> {
  return restructure('canvas:resize', state => ({
    ...state,
    width: sided(width),
    height: sided(height),
    layers: moveLayers(state, transform => ({
      ...transform,
      x: transform.x + offset.x,
      y: transform.y + offset.y,
    })),
  }))
}

/**
 * Resamples everything. The layers scale with the frame, which is what makes this different
 * from `resizeCanvas`: the frame moves there, and the content moves here.
 *
 * The pixels themselves are not resampled yet — the textures keep their original size and the
 * transforms carry the factor. That is milestone 10's, with the export.
 */
export function resizeImage(width: number, height: number): Command<CanvasState> {
  return restructure('canvas:resample', state => {
    const scaleX = sided(width) / state.width
    const scaleY = sided(height) / state.height

    return {
      ...state,
      width: sided(width),
      height: sided(height),
      layers: moveLayers(state, transform => ({
        ...transform,
        x: transform.x * scaleX,
        y: transform.y * scaleY,
        scaleX: transform.scaleX * scaleX,
        scaleY: transform.scaleY * scaleY,
      })),
    }
  })
}

export type FlipAxis = 'horizontal' | 'vertical'

/**
 * Mirrors the whole document. A negative scale rather than rewritten pixels: the layers keep
 * their textures, so flipping and flipping back is exactly the identity — which rewriting them
 * would not be, once resampling has rounded a pixel twice.
 */
export function flipImage(axis: FlipAxis): Command<CanvasState> {
  return restructure(`canvas:flip:${axis}`, state => ({
    ...state,
    layers: moveLayers(state, transform =>
      axis === 'horizontal'
        ? { ...transform, scaleX: -transform.scaleX, x: state.width - transform.x }
        : { ...transform, scaleY: -transform.scaleY, y: state.height - transform.y },
    ),
  }))
}

/**
 * Turns the document a quarter turn. The frame turns with it — a portrait becomes a landscape,
 * which is the whole point — and each layer turns about the document's centre rather than its
 * own, or a stack would fan out instead of turning as one picture.
 */
export function rotateImage(clockwise: boolean): Command<CanvasState> {
  return restructure(`canvas:rotate:${clockwise ? 'cw' : 'ccw'}`, state => {
    const quarter = clockwise ? Math.PI / 2 : -Math.PI / 2

    return {
      ...state,
      width: state.height,
      height: state.width,
      layers: moveLayers(state, transform => ({
        ...transform,
        rotation: transform.rotation + quarter,
        x: clockwise ? state.height - transform.y : transform.y,
        y: clockwise ? transform.x : state.width - transform.x,
      })),
    }
  })
}

/**
 * Cropping is the frame closing onto a rectangle. The layers deliberately do NOT move with it:
 * a surface is document-sized, and `CanvasEngine.resurface` recuts each one to the kept region,
 * so the picture is already where the new frame expects it. Displacing the transforms as well
 * would apply the same move twice and empty one side of the document.
 */
export function cropToRect(rect: Rect): Command<CanvasState> {
  return resizeCanvas(rect.width, rect.height, { x: 0, y: 0 })
}
