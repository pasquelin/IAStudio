import { DOCUMENT_VERSION, type DocumentFile } from '@shared/domain/document'
import { gltfDocumentOf } from './gltfDocument'
import { groupNode, meshNode } from './nodeFactory'
import { EMPTY_SCENE, type SceneNode } from './sceneState'

/** A barrel with a lid hanging off it — two nodes, so the hierarchy has something to keep. */
export function barrelNodes(): readonly SceneNode[] {
  const barrel = groupNode(undefined, 'Barrel')
  return [
    barrel,
    {
      ...meshNode({ kind: 'box', width: 1, height: 0.2, depth: 1 }, { name: 'BarrelLid' }),
      parentId: barrel.id,
    },
  ]
}

/**
 * That barrel as a document of the project — the glTF a save writes, in the envelope a read
 * answers with. Written any other way, a prefab instances nothing and no test says so.
 */
export function barrelDocument(id = 'doc-barrel'): DocumentFile {
  return {
    version: DOCUMENT_VERSION,
    kind: 'scene',
    title: 'Barrel',
    updatedAt: '2026-01-01T00:00:00.000Z',
    id,
    content: JSON.stringify(
      gltfDocumentOf(
        { ...EMPTY_SCENE, nodes: [...barrelNodes()] },
        {
          documentId: id,
          documentKind: 'scene',
        },
      ),
    ),
  }
}
