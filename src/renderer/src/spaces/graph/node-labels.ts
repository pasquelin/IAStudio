import type { GraphNodeType } from '@shared/domain/graph'

/**
 * The i18n key naming each node type, or `null` where the editor has no face for it yet and the
 * raw type is what it shows.
 *
 * A full `Record` rather than a `Partial`, for the reason `GRAPH_NODE_TYPES` gives beside its own:
 * a sixteenth type is then a compile error here rather than an English identifier sitting in a
 * French panel. Written once because the relation had three encodings — the palette composed the
 * key, the canvas wrote four literals, the inspector wrote the same four again — and only the
 * palette's were under a guard.
 *
 * Alone in its file: `panels/` reads it, and importing the palette for it would pull the node
 * factory into a chunk that has no use for one.
 */
export const NODE_LABEL_KEYS: Record<GraphNodeType, string | null> = {
  text: 'graph.nodes.text',
  asset: 'graph.nodes.asset',
  model: 'graph.nodes.model',
  stickyNote: 'graph.nodes.stickyNote',
  approval: 'graph.nodes.approval',
  ifElse: 'graph.nodes.ifElse',
  transformText: 'graph.nodes.transformText',
  forEach: 'graph.nodes.forEach',
  forEachEnd: 'graph.nodes.forEachEnd',
  aspectRatio: null,
  modelInput: null,
  llm: null,
  splitText: null,
  groupItems: null,
  sliceAssets: null,
}

/** Every key the record names, for the guard that checks the bundles carry them. */
export const NODE_LABEL_KEY_LIST: readonly string[] = Object.values(NODE_LABEL_KEYS).flatMap(
  key => key ?? [],
)
