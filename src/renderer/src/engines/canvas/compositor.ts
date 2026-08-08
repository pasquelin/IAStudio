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
      /** The layer whose mask texture hides part of this one. Today always itself. */
      maskedBy: string | null
    }
  | { kind: 'group'; id: string; isolated: boolean; children: CompositeNode[] }

/**
 * Where a layer's mask lives among the surfaces. One namespace for both, so an undo patch filed
 * under a key finds its way back without knowing which of the two it recorded.
 */
export function maskKey(layerId: string): string {
  return `${layerId}:mask`
}

/** Bottom first, like the stack itself: the last node is the one the eye sees on top. */
export function composite(layers: readonly Layer[]): CompositeNode[] {
  return layers.map((layer, index) => {
    if (isGroup(layer)) {
      return {
        kind: 'group',
        id: layer.id,
        isolated: layer.isolation === 'isolate',
        children: composite(layer.children),
      }
    }

    return {
      kind: 'surface',
      id: layer.id,
      clippedBy: clipBase(layers, index),
      maskedBy: layer.mask?.enabled === true ? layer.id : null,
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
        : `${node.id}:${node.clippedBy ?? ''}:${node.maskedBy ?? ''}`,
    )
    .join(' ')
}

/**
 * The first unclipped layer below this one, among its siblings only: a run of clipped layers
 * shares one base, as it does in Photoshop, and a group is a stack of its own.
 *
 * `null` when nothing lies under it — a clipped layer with no base is not clipped at all, and
 * hiding it would lose its pixels for a reason nobody could see.
 */
function clipBase(siblings: readonly Layer[], index: number): string | null {
  if (siblings[index]?.clipped !== true) return null

  for (let below = index - 1; below >= 0; below -= 1) {
    const candidate = siblings[below]
    if (candidate && !candidate.clipped) return candidate.id
  }
  return null
}
