import type { ReliefLayer, TerrainEditLayer, WorldLayer } from '@shared/domain/scene'
import type { TreeNode } from '@/components/Tree'

export type WorldNode = TreeNode & {
  kind: 'terrain' | 'edit'
  terrain: ReliefLayer
  edit: TerrainEditLayer | null
}

export function worldNodeId(terrainId: string, editId: string | null): string {
  return editId === null ? terrainId : `${terrainId}/${editId}`
}

export function worldNodes(layers: readonly WorldLayer[]): WorldNode[] {
  const nodes: WorldNode[] = []
  for (const layer of layers) {
    if (layer.kind !== 'relief') continue
    nodes.push({
      id: worldNodeId(layer.id, null),
      parentId: null,
      kind: 'terrain',
      terrain: layer,
      edit: null,
    })
    for (const edit of layer.edits) {
      nodes.push({
        id: worldNodeId(layer.id, edit.id),
        parentId: layer.id,
        kind: 'edit',
        terrain: layer,
        edit,
      })
    }
  }
  return nodes
}
