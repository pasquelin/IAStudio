import type { Command } from '../core/history'
import { clampOpacity, type CanvasState, type Layer } from './canvas-state'

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
  const index = state.layers.findIndex(layer => layer.id === id)
  const layers = state.layers.filter(layer => layer.id !== id)
  if (state.activeLayerId !== id) return { ...state, layers }

  const neighbour = layers[Math.min(index, layers.length - 1)]
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

/** One shape for every single-field edit: they all revert by putting the old value back. */
function patch(commandId: string, id: string, fields: Partial<Layer>): Command<CanvasState> {
  let previous: Layer | null = null

  return {
    id: commandId,
    apply: state => {
      previous = state.layers.find(layer => layer.id === id) ?? null
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
    layers: state.layers.map(layer => (layer.id === id ? (change(layer) ?? layer) : layer)),
  }
}

/** Selection stays out of the history: nobody wants ⌘Z to give them back a selected layer. */
export function selectLayer(state: CanvasState, id: string | null): CanvasState {
  return { ...state, activeLayerId: id }
}
