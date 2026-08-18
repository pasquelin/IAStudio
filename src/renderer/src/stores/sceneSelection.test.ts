import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CameraMotion } from '@shared/domain/animation'
import { addNode } from '@/engines/scene/commands'
import { cameraShot } from '@/engines/scene/animation-fixtures'
import { cameraNodeFixture, meshNode, pathNodeFixture } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneNode } from '@/engines/scene/sceneState'
import { installDocuments } from './document-fixtures'
import { useDocuments } from './documents'
import { connectSceneSelection } from './sceneSelection'
import { sceneViewOf, useSceneViews } from './sceneViews'
import { selectIn, useScenes } from './scenes'
import { useSelection } from './selection'

/** The one shot of these tests: `cam-a` riding `rail`, which is what `railsInUse` reads. */
const PATH_MOTION: CameraMotion = { pathId: 'rail', easing: 'linear', from: 0, to: 1 }

/** Two scenes side by side, since half of what this connector decides is WHICH one is answered. */
function twoScenes(activeId: string): void {
  useScenes.setState({
    states: { 'doc-1': EMPTY_SCENE, 'doc-2': EMPTY_SCENE },
    histories: {},
    saved: {},
  })
  installDocuments({ 'doc-1': '3d', 'doc-2': '3d' }, activeId)
}

const kind = (): string => useSelection.getState().selection.kind

describe('what points the inspector at a scene', () => {
  let stop = (): void => {}

  beforeEach(() => {
    useSelection.getState().selectAssets(['asset-1'])
    stop = connectSceneSelection()
  })

  afterEach(() => {
    stop()
    useSelection.getState().clear()
    useDocuments.setState({ documents: {}, activeId: null })
  })

  /**
   * The command, not the click — an import selects the model it just put down, and that path never
   * goes through `selectIn`. Left alone, the panel described the asset that was dropped while the
   * outliner highlighted the node it had become.
   */
  it('follows a selection a command made, not only one a pointer made', () => {
    twoScenes('doc-1')

    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))

    expect(useSelection.getState().selection).toEqual({
      kind: 'node',
      ownerId: 'doc-1',
      ids: [],
    })
  })

  // A 3D generation lands in the tab it was launched from, which is rarely the one being looked
  // at. Answered there, it would take the panel off whatever its owner was editing.
  it('says nothing for a scene that is not the tab in front', () => {
    twoScenes('doc-2')

    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))

    expect(kind()).toBe('asset')
  })

  /**
   * The other half of that rule, and without it the filter above only moves the defect: what a
   * background tab selected has to be answered the moment that tab comes forward.
   */
  it('answers a tab brought forward over what it had already selected', () => {
    twoScenes('doc-2')
    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))
    expect(kind()).toBe('asset')

    installDocuments({ 'doc-1': '3d', 'doc-2': '3d' }, 'doc-1')

    expect(kind()).toBe('node')
  })

  // A tab with nothing picked has nothing to say, and clearing there would take the panel off
  // whatever was picked in another panel.
  it('leaves the panel alone when the tab brought forward has nothing selected', () => {
    twoScenes('doc-2')

    installDocuments({ 'doc-1': '3d', 'doc-2': '3d' }, 'doc-1')

    expect(kind()).toBe('asset')
  })

  it('stops answering once undone', () => {
    twoScenes('doc-1')
    stop()

    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-1')))

    expect(kind()).toBe('asset')
  })
})

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
    stop = connectSceneSelection()
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
