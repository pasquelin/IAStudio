import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset, AssetType } from '@shared/domain/asset'
import { openAsset } from '@/helpers/openAsset'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from './documents'
import { useProject } from './project'
import { clearScenes } from './scene-fixtures'
import { addModelTo, sceneOf, useScenes } from './scenes'

function asset(id: string, type: AssetType, name = id): Asset {
  return {
    id,
    name,
    type,
    location: 'local',
    path: `assets/${id}`,
    tags: [],
    createdAt: '2026-08-08T00:00:00.000Z',
  }
}

function nodesOf(documentId: string) {
  return sceneOf(useScenes.getState(), documentId).nodes
}

beforeEach(() => {
  clearScenes()
  useDocuments.setState({
    documents: {
      'doc-1': {
        id: 'doc-1',
        kind: 'scene',
        workspace: '3d',
        title: 'Set',
        path: 'documents/Set.gltf',
      },
    },
    activeId: 'doc-1',
  })
})

describe('addModelTo', () => {
  it('adds one node holding a reference, whatever the file weighs', () => {
    expect(addModelTo('doc-1', asset('mesh-1', 'mesh', 'Chair'))).toBe(true)

    const models = nodesOf('doc-1').filter(node => node.type === 'model')
    expect(models).toHaveLength(1)
    expect(models[0]?.type === 'model' && models[0].model.assetId).toBe('mesh-1')
  })

  // Two cubes are both `Box`; two imported models are two files, and the outliner is where you
  // tell them apart.
  it('names the node after the asset', () => {
    addModelTo('doc-1', asset('mesh-1', 'mesh', 'Wooden chair'))
    expect(nodesOf('doc-1').at(-1)?.name).toBe('Wooden chair')
  })

  it('refuses an asset of another type rather than making an empty node', () => {
    expect(addModelTo('doc-1', asset('img-1', 'image'))).toBe(false)
    expect(nodesOf('doc-1').filter(node => node.type === 'model')).toHaveLength(0)
  })

  it('goes through the history, so an import can be undone', () => {
    addModelTo('doc-1', asset('mesh-1', 'mesh'))
    useScenes.getState().undo('doc-1')

    expect(nodesOf('doc-1').filter(node => node.type === 'model')).toHaveLength(0)
  })

  it('selects what it just added, so the gizmo has something to hold', () => {
    addModelTo('doc-1', asset('mesh-1', 'mesh'))

    const { selectedIds, nodes } = sceneOf(useScenes.getState(), 'doc-1')
    expect(selectedIds).toEqual([nodes.at(-1)?.id])
  })
})

// The first of the three doors: a double-click in the asset browser. What it settles here is
// which scene receives the model — `openAsset.test.ts` holds the gesture itself.
describe('opening a model asset', () => {
  beforeEach(() => {
    installFakeBridge()
    useProject.setState({
      project: {
        path: '/projects/demo',
        manifest: { version: 1, createdAt: '', updatedAt: '' },
      },
      known: true,
    })
  })

  /**
   * A scene in front is not this mesh's scene. Dropping into it was the old rule, and it made
   * one gesture mean two things — the tab under the eye decided, so the same double-click landed
   * somewhere else the next time. Placing into the scene one is working in is what the context
   * menu and the drag are for.
   */
  it('opens it in a scene of its own rather than the one in front', async () => {
    await openAsset(asset('mesh-1', 'mesh'))

    expect(nodesOf('doc-1').filter(node => node.type === 'model')).toHaveLength(0)
    const made = Object.values(useDocuments.getState().documents).at(-1)
    expect(made?.sourceAssetId).toBe('mesh-1')
    expect(nodesOf(made?.id ?? '').filter(node => node.type === 'model')).toHaveLength(1)
  })

  it('leaves a picture alone, which belongs to another workspace', async () => {
    await openAsset(asset('img-1', 'image'))
    expect(nodesOf('doc-1').filter(node => node.type === 'model')).toHaveLength(0)
  })
})
