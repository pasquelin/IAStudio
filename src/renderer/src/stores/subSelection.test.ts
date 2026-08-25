import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CameraMotion } from '@shared/domain/animation'
import { cameraShot } from '@/engines/scene/animation-fixtures'
import { cameraNodeFixture, meshNode, pathNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneNode } from '@/engines/scene/sceneState'
import { installDocuments } from './document-fixtures'
import { connectSubSelectionRelease } from './subSelection'
import { sceneViewOf, useSceneViews } from './sceneViews'
import { selectIn, useScenes } from './scenes'

/** The one shot of these tests: `cam-a` riding `rail`, which is what `railsInUse` reads. */
const PATH_MOTION: CameraMotion = { pathId: 'rail', easing: 'linear', from: 0, to: 1 }

/**
 * A bone and a control point are picked INSIDE something selected. The selection moves on through
 * doors that know nothing of them — `selectIn`, but also every command that rewrites it — and a
 * pick left behind arms the wrong gesture: Delete took a control point instead of the object just
 * chosen in the tree, and the gizmo stayed on the bone of a model one had moved away from.
 */
describe('what lets go of a sub-selection', () => {
  let stop = (): void => {}

  beforeEach(() => {
    useSceneViews.setState({ views: {} })
    stop = connectSubSelectionRelease()
  })

  afterEach(() => stop())

  const install = (nodes: SceneNode[], selectedIds: string[]): void => {
    useScenes.setState({
      states: { 'doc-1': { ...EMPTY_SCENE, nodes, selectedIds } },
      histories: {},
      saved: {},
    })
    installDocuments({ 'doc-1': '3d' }, 'doc-1')
  }

  const picked = () => sceneViewOf(useSceneViews.getState(), 'doc-1')

  it('drops the control point when its rail is no longer selected', () => {
    install([pathNodeFixture('rail'), meshNode('box')], ['rail'])
    useSceneViews.getState().setPickedPathPoint('doc-1', { nodeId: 'rail', index: 1 })

    selectIn('doc-1', ['box'])

    expect(picked().pickedPathPoint).toBeNull()
  })

  // A rail a selected CAMERA rides is being worked on too — `railsInUse` — and grabbing a knob of
  // one would otherwise let go of it on the spot.
  it('keeps the control point of a rail the selected camera rides', () => {
    useScenes.setState({
      states: {
        'doc-1': {
          ...EMPTY_SCENE,
          nodes: [pathNodeFixture('rail'), cameraNodeFixture('cam-a'), meshNode('box')],
          selectedIds: ['box'],
          animation: {
            ...EMPTY_SCENE.animation,
            shots: [cameraShot('shot-1', { motion: PATH_MOTION })],
          },
        },
      },
      histories: {},
      saved: {},
    })
    installDocuments({ 'doc-1': '3d' }, 'doc-1')
    useSceneViews.getState().setPickedPathPoint('doc-1', { nodeId: 'rail', index: 1 })

    selectIn('doc-1', ['cam-a'])

    expect(picked().pickedPathPoint).toEqual({ nodeId: 'rail', index: 1 })
  })

  // Nothing guarded these at all: leaving pose mode was the only thing that ever let one go.
  it('drops the bone when its model is no longer selected', () => {
    install([meshNode('perso'), meshNode('box')], ['perso'])
    useSceneViews.getState().setPickedBone('doc-1', { nodeId: 'perso', bone: 'Hips' })

    selectIn('doc-1', ['box'])

    expect(picked().pickedBone).toBeNull()
  })

  it('leaves a pick alone while what holds it is still selected', () => {
    install([meshNode('perso'), meshNode('box')], ['perso'])
    useSceneViews.getState().setPickedBone('doc-1', { nodeId: 'perso', bone: 'Hips' })

    selectIn('doc-1', ['perso', 'box'])

    expect(picked().pickedBone).toEqual({ nodeId: 'perso', bone: 'Hips' })
  })
})
