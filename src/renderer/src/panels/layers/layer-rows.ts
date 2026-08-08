import { isGroup, type Layer } from '@/engines/canvas/canvas-state'

/** A layer as the list draws it: how deep it sits, and what identifies its row. */
export type LayerRowEntry = {
  /** The layer's own id — `Collection` keys and selects on this. */
  id: string
  layer: Layer
  /** 0 at the root. Each step indents the row, so a stack reads as the tree it is. */
  depth: number
}

/**
 * The stack as one flat list, top of the list first — what the eye sees on top is what the hand
 * reaches first, and every editor lays it out that way. The state stores it the other way round,
 * bottom first, because that is the order it is drawn in.
 *
 * A collapsed group keeps its own row and hides its subtree: the point of folding it is that the
 * stack of a busy document stays readable.
 */
export function layerRows(layers: readonly Layer[], depth = 0): LayerRowEntry[] {
  const rows: LayerRowEntry[] = []

  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index]
    if (!layer) continue

    rows.push({ id: layer.id, layer, depth })
    if (isGroup(layer) && !layer.collapsed) rows.push(...layerRows(layer.children, depth + 1))
  }

  return rows
}
