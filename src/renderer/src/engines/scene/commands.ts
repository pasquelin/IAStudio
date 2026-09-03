export {
  attachComponent,
  attachNode,
  detachComponent,
  renameNode,
  setComponentField,
  setGeometry,
  setLight,
  setMeshMaterial,
  setNodeMaterial,
  setNodeVisible,
  setTransform,
  withAxisHeld,
  type NodeEdit,
} from './nodeEditCommands'
export {
  batch,
  multi,
  setGeometryOn,
  setLightOn,
  setMaterialOn,
  setShadowOn,
} from './nodeBatchCommands'
export {
  addModelClip,
  dressModel,
  removeModelClip,
  setCamera,
  setCameraOn,
  setModelLanes,
  setPath,
  setSprite,
  setSpriteOn,
  setText,
  setTextMaterial,
  setTextOn,
  wearMaterialAt,
} from './nodeDescriptorCommands'
export {
  canMoveNode,
  carveNodes,
  groupNodes,
  invertCarve,
  negateNodes,
  reorderNodes,
  reparentNode,
  separateNode,
  setNodesNegative,
} from './nodeTreeCommands'
export {
  addNode,
  addNodes,
  copiesOf,
  moveNodes,
  removeNode,
  removeNodes,
  rootedIn,
  setSelection,
  setWorld,
} from './nodeBulkCommands'

import type { Command } from '../core/history'
import { batch } from './nodeBatchCommands'
import { editNode } from './nodeEditCommands'
import type { OptimizationSettings, SceneNode, SceneState } from './sceneState'

export function setNodesOptimization(
  nodes: readonly SceneNode[],
  optimization: OptimizationSettings | undefined,
): Command<SceneState> {
  return batch('optimization', nodes, node =>
    editNode('optimization', node.id, { optimization }),
  )
}
