import { beforeEach, describe, expect, it } from 'vitest'
import { meshNode, pathNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { clearScenes, installScene, sceneNodeNow } from '@/stores/scene-fixtures'
import { useSceneViews } from '@/stores/sceneViews'
import { runSceneCommand } from './sceneCommands'

const DOCUMENT = 'doc-1'

const at = (x: number) => ({ x, y: 0, z: 0 })

const rail = () => pathNodeFixture('rail', { points: [at(0), at(10), at(20)] })

const pointsNow = (): number[] => {
  const node = sceneNodeNow(DOCUMENT, 'rail')
  return node?.type === 'path' ? node.path.points.map(point => point.x) : []
}

beforeEach(() => {
  clearScenes()
  useSceneViews.setState({ views: {} })
  installScene(DOCUMENT, { ...EMPTY_SCENE, nodes: [rail()], selectedIds: ['rail'] })
})

describe('deleting while a control point is held', () => {
  it('takes the point away and leaves the rail standing', () => {
    useSceneViews.getState().setPickedPathPoint(DOCUMENT, { nodeId: 'rail', index: 1 })

    runSceneCommand(DOCUMENT, 'scene.delete')

    expect(pointsNow()).toEqual([0, 20])
    expect(sceneNodeNow(DOCUMENT, 'rail')).not.toBeNull()
  })

  it('lets go of the point it took, so the gizmo holds nothing that is gone', () => {
    useSceneViews.getState().setPickedPathPoint(DOCUMENT, { nodeId: 'rail', index: 1 })

    runSceneCommand(DOCUMENT, 'scene.delete')

    expect(useSceneViews.getState().views[DOCUMENT]?.pickedPathPoint).toBeNull()
  })

  /**
   * One point is not a line, so `withoutPoint` refuses — and the refusal has to stay handled:
   * falling through to the selection would delete the rail the gesture was working on.
   */
  it('keeps both the point and the rail when the rail is down to two points', () => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [pathNodeFixture('rail', { points: [at(0), at(10)] })],
      selectedIds: ['rail'],
    })
    useSceneViews.getState().setPickedPathPoint(DOCUMENT, { nodeId: 'rail', index: 0 })

    runSceneCommand(DOCUMENT, 'scene.delete')

    expect(pointsNow()).toEqual([0, 10])
    expect(sceneNodeNow(DOCUMENT, 'rail')).not.toBeNull()
  })

  it('deletes the selected rail itself when no point is held', () => {
    runSceneCommand(DOCUMENT, 'scene.delete')

    expect(sceneNodeNow(DOCUMENT, 'rail')).toBeNull()
  })

  /**
   * A point is picked by a click in the VIEWPORT and let go of by another one; the tree selects
   * through a door that knows nothing of it. Without this, a point left over from a rail worked
   * on earlier ate the Delete meant for the object just picked in the tree.
   */
  it('lets Delete through to the tree’s selection when the point belongs to another rail', () => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [rail(), meshNode('box')],
      selectedIds: ['box'],
    })
    useSceneViews.getState().setPickedPathPoint(DOCUMENT, { nodeId: 'rail', index: 1 })

    runSceneCommand(DOCUMENT, 'scene.delete')

    expect(sceneNodeNow(DOCUMENT, 'box')).toBeNull()
    expect(pointsNow()).toEqual([0, 10, 20])
  })

  // The same leftover on a rail already at its floor swallowed every Delete and did nothing.
  it('lets Delete through even when the leftover point could not have been removed anyway', () => {
    installScene(DOCUMENT, {
      ...EMPTY_SCENE,
      nodes: [pathNodeFixture('rail', { points: [at(0), at(10)] }), meshNode('box')],
      selectedIds: ['box'],
    })
    useSceneViews.getState().setPickedPathPoint(DOCUMENT, { nodeId: 'rail', index: 0 })

    runSceneCommand(DOCUMENT, 'scene.delete')

    expect(sceneNodeNow(DOCUMENT, 'box')).toBeNull()
  })
})
