import { isGroup, type Layer } from './canvas-state'

/**
 * What the engine has to build, as plain data: one node per layer, groups nesting.
 *
 * It answers the questions a stack asks before a single texture is touched — which sprite cuts
 * which, which container holds which group — so they can be tested without a GPU.
 */
export type CompositeNode =
  | {
      kind: 'surface'
      id: string
      /** The layer whose alpha cuts this one out, or `null` when nothing does. */
      clippedBy: string | null
      /** The layer whose mask texture this one carries. Today always itself. */
      maskedBy: string | null
      /** Whether that mask hides anything: unticking the box keeps its pixels on the GPU. */
      maskEnabled: boolean
    }
  | { kind: 'group'; id: string; children: CompositeNode[] }

/**
 * Where a layer's mask lives among the surfaces. One namespace for both, so an undo patch filed
 * under a key finds its way back without knowing which of the two it recorded.
 */
export function maskKey(layerId: string): string {
  return `${layerId}:mask`
}

/** Bottom first, like the stack itself: the last node is the one the eye sees on top. */
export function composite(layers: readonly Layer[]): CompositeNode[] {
  // The base a clipped layer is cut out of: the last unclipped one below it, carried forward as
  // the level is walked. A run of clipped layers shares one base, as it does in Photoshop.
  let base: string | null = null

  return layers.map(layer => {
    if (isGroup(layer)) {
      if (!layer.clipped) base = layer.id
      return { kind: 'group', id: layer.id, children: composite(layer.children) }
    }

    // `null` when nothing lies under it: a clipped layer with no base is not clipped at all, and
    // hiding it would lose its pixels for a reason nobody could see.
    const clippedBy = layer.clipped ? base : null
    if (!layer.clipped) base = layer.id

    return {
      kind: 'surface',
      id: layer.id,
      clippedBy,
      maskedBy: layer.mask ? layer.id : null,
      maskEnabled: layer.mask?.enabled === true,
    }
  })
}

/**
 * Everything the built tree depends on, as one string. A state that leaves it unchanged — a layer
 * being dragged, a guide being laid — must not cost a rebuild of the whole document.
 */
export function placement(nodes: readonly CompositeNode[]): string {
  return nodes
    .map(node =>
      node.kind === 'group'
        ? `${node.id}(${placement(node.children)})`
        : `${node.id}:${node.clippedBy ?? ''}:${node.maskedBy ?? ''}${node.maskEnabled ? '!' : ''}`,
    )
    .join(' ')
}
