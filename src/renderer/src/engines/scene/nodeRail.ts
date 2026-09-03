import type { PathDescriptor } from '@shared/domain/scene'
import type { SceneNode } from './sceneState'

/**
 * The rail a node carries, whether it IS one or is swept along one.
 *
 * 🛑 One reading for the two, or the knobs and the edit come to disagree: the viewport would
 * draw handles on a band the commands then refuse to move.
 */
export function railOf(node: SceneNode | undefined): PathDescriptor | null {
  if (!node) return null
  if (node.type === 'path') return node.path
  return node.type === 'mesh' && node.geometry.kind === 'ribbon' ? node.geometry.path : null
}
