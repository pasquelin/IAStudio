import { isRecord } from '@shared/guards'

/**
 * What a row of the outliner carries while it is dragged, and what the animation band reads when
 * it is let go over it.
 *
 * In a module of its own because both halves need it — the same reason `panels/animations/dragged`
 * has one: a type imported back from the panel by its target closes an import cycle, and
 * `import-cycles.test.ts` holds those at zero.
 */
export type DraggedSceneNodes = { nodeIds: readonly string[] }

/** The drag format. Namespaced so a file dropped from the desktop is never read as one of these. */
export const SCENE_NODE_DRAG_TYPE = 'application/x-scenario-scene-node'

/** What was dropped, or nothing: the payload crossed a `dataTransfer` as text and is not typed. */
export function draggedSceneNodesOf(value: unknown): DraggedSceneNodes | null {
  if (!isRecord(value) || !Array.isArray(value.nodeIds)) return null

  const nodeIds = value.nodeIds.filter(id => typeof id === 'string')
  return nodeIds.length === 0 ? null : { nodeIds }
}
