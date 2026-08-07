import type { Command } from '../core/history'
import {
  allLayers,
  clampOpacity,
  isGroup,
  mapLayers,
  IDENTITY,
  UNLOCKED,
  type BlendMode,
  type CanvasState,
  type GroupLayer,
  type Layer,
  type LayerLocks,
  type PixelLayer,
  type Rect,
} from './canvas-state'

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
  let removed: Layer | null = null
  let index = -1
  let wasActive = false

  return {
    id: `layer:remove:${id}`,
    apply: state => {
      index = state.layers.findIndex(layer => layer.id === id)
      // The last layer never goes: a document with an empty stack cannot be painted on.
      if (index < 0 || state.layers.length === 1) return state

      removed = state.layers[index] ?? null
      wasActive = state.activeLayerId === id
      return withoutLayer(state, id)
    },
    revert: state => {
      if (!removed || index < 0) return state
      const layers = [...state.layers]
      // Back at its original index: re-appending would silently restack the document.
      layers.splice(index, 0, removed)
      return { ...state, layers, activeLayerId: wasActive ? removed.id : state.activeLayerId }
    },
  }
}

/** Removing the active layer moves the selection to a neighbour, never leaves it dangling. */
function withoutLayer(state: CanvasState, id: string): CanvasState {
  const flat = allLayers(state.layers)
  const index = flat.findIndex(layer => layer.id === id)
  const layers = mapLayers(state.layers, layer => (layer.id === id ? null : layer))
  if (state.activeLayerId !== id) return { ...state, layers }

  const remaining = allLayers(layers)
  const neighbour = remaining[Math.min(index, remaining.length - 1)]
  return { ...state, layers, activeLayerId: neighbour?.id ?? null }
}

export function reorderLayer(id: string, toIndex: number): Command<CanvasState> {
  let fromIndex = -1

  return {
    id: `layer:reorder:${id}`,
    apply: state => {
      fromIndex = state.layers.findIndex(layer => layer.id === id)
      return fromIndex < 0 ? state : moved(state, fromIndex, toIndex)
    },
    revert: state => (fromIndex < 0 ? state : moved(state, toIndex, fromIndex)),
  }
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

function moved(state: CanvasState, from: number, to: number): CanvasState {
  const layers = [...state.layers]
  const [layer] = layers.splice(from, 1)
  if (!layer) return state
  layers.splice(Math.min(Math.max(to, 0), layers.length), 0, layer)
  return { ...state, layers }
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
      // Spread per kind rather than once over the union: TypeScript cannot see that spreading
      // shared fields onto `Layer` leaves it in the union, and this repo takes no `as`.
      return mapLayer(state, id, layer => {
        switch (layer.kind) {
          case 'group':
            return { ...layer, ...fields }
          case 'adjustment':
            return { ...layer, ...fields }
          default:
            return { ...layer, ...fields }
        }
      })
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

/** Selection stays out of the history: nobody wants ⌘Z to give them back a selected layer. */
export function selectLayer(state: CanvasState, id: string | null): CanvasState {
  return { ...state, activeLayerId: id }
}

/**
 * A pixel layer with every default filled in. Twelve fields to spell out otherwise, and every
 * caller that forgets one gets a layer the compositor treats differently for no visible reason.
 */
export function pixelLayer(id: string, name: string, fill?: number): PixelLayer {
  return {
    kind: 'pixel',
    id,
    name,
    visible: true,
    locked: UNLOCKED,
    opacity: 1,
    fillOpacity: 1,
    blend: 'normal',
    clipped: false,
    transform: IDENTITY,
    fill,
  }
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
  let before: Pick<CanvasState, 'layers' | 'activeLayerId'> | null = null

  return {
    id: commandId,
    apply: state => {
      before = { layers: state.layers, activeLayerId: state.activeLayerId }
      return change(state)
    },
    revert: state => (before ? { ...state, ...before } : state),
  }
}

/** The layers named, in stack order, and only those at the top level — a group moves whole. */
function taken(layers: readonly Layer[], ids: ReadonlySet<string>): Layer[] {
  return layers.filter(layer => ids.has(layer.id))
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
    const members = taken(state.layers, wanted)
    if (members.length === 0) return state

    const last = state.layers.findIndex(layer => layer.id === members.at(-1)?.id)
    const rest = state.layers.filter(layer => !wanted.has(layer.id))
    const group: GroupLayer = {
      ...pixelLayer(groupId, name),
      kind: 'group',
      children: members,
      collapsed: false,
      isolation: 'pass-through',
    }

    // Where the topmost member was, minus the members removed below it: the group must not
    // jump above what used to cover it.
    const below = state.layers.slice(0, last).filter(layer => wanted.has(layer.id)).length
    const at = Math.max(0, last - below)
    return {
      ...state,
      layers: [...rest.slice(0, at), group, ...rest.slice(at)],
      activeLayerId: groupId,
    }
  })
}

/** Dissolves a group, leaving its children where it stood. */
export function ungroupLayer(id: string): Command<CanvasState> {
  return restructure(`layer:ungroup:${id}`, state => {
    const index = state.layers.findIndex(layer => layer.id === id)
    const group = state.layers[index]
    if (!group || !isGroup(group)) return state

    const layers = [
      ...state.layers.slice(0, index),
      ...group.children,
      ...state.layers.slice(index + 1),
    ]
    return { ...state, layers, activeLayerId: group.children.at(-1)?.id ?? state.activeLayerId }
  })
}

/**
 * Merges a layer into the one below it. The pixels are the engine's to composite; what the
 * stack records is that two layers became one, keeping the lower one's name as every editor does.
 */
export function mergeDown(id: string): Command<CanvasState> {
  return restructure(`layer:merge-down:${id}`, state => {
    const index = state.layers.findIndex(layer => layer.id === id)
    const below = state.layers[index - 1]
    if (index < 1 || !below) return state

    // The merged result takes the lower layer's identity, so its texture is the one kept.
    const layers = state.layers.filter((_, at) => at !== index)
    return { ...state, layers, activeLayerId: below.id }
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

export function duplicateLayer(id: string, copyId: string, name: string): Command<CanvasState> {
  return restructure(`layer:duplicate:${id}`, state => {
    const index = state.layers.findIndex(layer => layer.id === id)
    const source = state.layers[index]
    if (!source) return state

    const copy: Layer = { ...source, id: copyId, name }
    const layers = [...state.layers]
    layers.splice(index + 1, 0, copy)
    return { ...state, layers, activeLayerId: copyId }
  })
}

/**
 * Changes the frame without touching a pixel. The layers keep their own position, so the anchor
 * decides what slides out of view — this is `Canvas size`, not `Image size`.
 */
export function resizeCanvas(width: number, height: number, anchor: Rect): Command<CanvasState> {
  return restructure('canvas:resize', state => ({
    ...state,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    layers: mapLayers(state.layers, layer => ({
      ...layer,
      transform: {
        ...layer.transform,
        x: layer.transform.x + anchor.x,
        y: layer.transform.y + anchor.y,
      },
    })),
  }))
}

/**
 * Resamples everything. The layers scale with the frame, which is what makes this different
 * from `resizeCanvas` — the engine resamples the textures by the same factor.
 */
export function resizeImage(width: number, height: number): Command<CanvasState> {
  return restructure('canvas:resample', state => {
    const next = { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
    const scaleX = next.width / state.width
    const scaleY = next.height / state.height

    return {
      ...state,
      ...next,
      layers: mapLayers(state.layers, layer => ({
        ...layer,
        transform: {
          ...layer.transform,
          x: layer.transform.x * scaleX,
          y: layer.transform.y * scaleY,
          scaleX: layer.transform.scaleX * scaleX,
          scaleY: layer.transform.scaleY * scaleY,
        },
      })),
    }
  })
}

/** Crops to a rectangle in document coordinates — the frame moves onto it, the pixels do not. */
export function cropToRect(rect: Rect): Command<CanvasState> {
  return restructure('canvas:crop', state => ({
    ...state,
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
    layers: mapLayers(state.layers, layer => ({
      ...layer,
      transform: {
        ...layer.transform,
        x: layer.transform.x - rect.x,
        y: layer.transform.y - rect.y,
      },
    })),
  }))
}
