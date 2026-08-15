import { isGroup, layerById, type CanvasState, type Layer } from '@/engines/canvas/canvas-state'

/** A layer as the tree walks it: `Tree` reads `id` and `parentId`, the row reads the layer. */
export type LayerNode = {
  id: string
  /** `null` at the root of the stack. */
  parentId: string | null
  layer: Layer
}

/**
 * The stack as one flat list, top of the list first — what the eye sees on top is what the hand
 * reaches first, and every editor lays it out that way. The state stores it the other way round,
 * bottom first, because that is the order it is drawn in.
 *
 * Folding is not decided here: a group keeps its `collapsed` flag and `Tree` hides the subtree,
 * so the same list serves whether a group is open or shut.
 */
export function layerNodes(layers: readonly Layer[], parentId: string | null = null): LayerNode[] {
  const nodes: LayerNode[] = []

  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index]
    if (!layer) continue

    nodes.push({ id: layer.id, parentId, layer })
    if (isGroup(layer)) nodes.push(...layerNodes(layer.children, layer.id))
  }

  return nodes
}

/**
 * The index `moveLayer` takes, from the one the list reports. The two count from opposite ends —
 * the list runs top first, the state bottom first — so a drop at the top of a level lands at the
 * end of it, and the arithmetic is the whole reason this is a function with a test rather than a
 * line inside a drop handler.
 *
 * `index` counts the target level once `movedId` has left it, which is what `Tree` reports, and
 * which is also what `moveLayer` expects: the two ends agree, and only the direction flips.
 */
export function stackIndex(
  state: CanvasState,
  movedId: string,
  parentId: string | null,
  index: number,
): number {
  const level = levelOf(state, parentId)
  const size = level.length - (level.some(layer => layer.id === movedId) ? 1 : 0)

  return size - index
}

/**
 * Where `movedId` sits in that level today, or `null` when it lives somewhere else — which is
 * how a drop that changes nothing is told from one that moves something.
 *
 * A command that rebuilds the stack into an identical stack still takes a place in the history,
 * and the ⌘Z that follows appears to do nothing at all.
 */
export function levelIndexOf(
  state: CanvasState,
  movedId: string,
  parentId: string | null,
): number | null {
  const at = levelOf(state, parentId).findIndex(layer => layer.id === movedId)
  return at < 0 ? null : at
}

function levelOf(state: CanvasState, parentId: string | null): readonly Layer[] {
  if (parentId === null) return state.layers

  const parent = layerById(state, parentId)
  return parent !== null && isGroup(parent) ? parent.children : []
}
