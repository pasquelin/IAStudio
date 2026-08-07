import { beforeEach, describe, expect, it } from 'vitest'
import { canRedo, canUndo } from '@/engines/core/history'
import { addNode } from '@/engines/scene/commands'
import { createDefaultScene } from '@/engines/scene/default-scene'
import {
  DEFAULT_MATERIAL,
  EMPTY_SCENE,
  IDENTITY_TRANSFORM,
  type SceneNode,
} from '@/engines/scene/scene-state'
import { historyOf, sceneOf, useScenes } from './scenes'

const box: SceneNode = {
  id: 'box-1',
  parentId: null,
  name: 'Box',
  visible: true,
  transform: IDENTITY_TRANSFORM,
  type: 'mesh',
  geometry: { kind: 'box', width: 1, height: 1, depth: 1 },
  material: DEFAULT_MATERIAL,
}

describe('scenes store', () => {
  beforeEach(() => {
    useScenes.setState({ states: {}, histories: {} })
  })

  it('gives an empty scene for a document never opened', () => {
    expect(sceneOf(useScenes.getState(), 'unknown')).toEqual(EMPTY_SCENE)
  })

  it('runs a command against the right document', () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    expect(sceneOf(useScenes.getState(), 'doc-1').nodes).toHaveLength(1)
    expect(sceneOf(useScenes.getState(), 'doc-2').nodes).toHaveLength(0)
  })

  it('keeps one history per document', () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    expect(canUndo(historyOf(useScenes.getState(), 'doc-1'))).toBe(true)
    expect(canUndo(historyOf(useScenes.getState(), 'doc-2'))).toBe(false)
  })

  it('undoes and redoes within one document', () => {
    const { runCommand, undo, redo } = useScenes.getState()
    runCommand('doc-1', addNode(box))

    undo('doc-1')
    expect(sceneOf(useScenes.getState(), 'doc-1').nodes).toHaveLength(0)
    expect(canRedo(historyOf(useScenes.getState(), 'doc-1'))).toBe(true)

    redo('doc-1')
    expect(sceneOf(useScenes.getState(), 'doc-1').nodes).toHaveLength(1)
  })

  it('forgets a scene and its history when the document closes', () => {
    useScenes.getState().runCommand('doc-1', addNode(box))
    useScenes.getState().drop('doc-1')
    expect(useScenes.getState().states['doc-1']).toBeUndefined()
    expect(useScenes.getState().histories['doc-1']).toBeUndefined()
  })
})

describe('ensure', () => {
  beforeEach(() => {
    useScenes.setState({ states: {}, histories: {} })
  })

  it('installs the default scene the first time a document is opened', () => {
    useScenes.getState().ensure('doc-1', createDefaultScene)
    expect(sceneOf(useScenes.getState(), 'doc-1').nodes).toHaveLength(3)
  })

  it('leaves an existing scene alone, so reopening a tab does not reset it', () => {
    useScenes.getState().ensure('doc-1', createDefaultScene)
    const before = sceneOf(useScenes.getState(), 'doc-1')

    useScenes.getState().ensure('doc-1', createDefaultScene)
    expect(sceneOf(useScenes.getState(), 'doc-1')).toBe(before)
  })

  it('gives two documents their own nodes rather than a shared default', () => {
    useScenes.getState().ensure('doc-1', createDefaultScene)
    useScenes.getState().ensure('doc-2', createDefaultScene)

    const first = sceneOf(useScenes.getState(), 'doc-1').nodes[0]?.id
    const second = sceneOf(useScenes.getState(), 'doc-2').nodes[0]?.id
    expect(first).not.toBe(second)
  })
})
