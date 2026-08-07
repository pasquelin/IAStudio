import { beforeEach, describe, expect, it } from 'vitest'
import { canRedo, canUndo } from '@/engines/core/history'
import { addObject } from '@/engines/scene/commands'
import { EMPTY_SCENE, IDENTITY_TRANSFORM, type SceneObject } from '@/engines/scene/scene-state'
import { historyOf, sceneOf, useScenes } from './scenes'

const box: SceneObject = { id: 'box-1', kind: 'box', name: 'Box', transform: IDENTITY_TRANSFORM }

describe('scenes store', () => {
  beforeEach(() => {
    useScenes.setState({ states: {}, histories: {} })
  })

  it('gives an empty scene for a document never opened', () => {
    expect(sceneOf(useScenes.getState(), 'unknown')).toEqual(EMPTY_SCENE)
  })

  it('runs a command against the right document', () => {
    useScenes.getState().runCommand('doc-1', addObject(box))
    expect(sceneOf(useScenes.getState(), 'doc-1').objects).toHaveLength(1)
    expect(sceneOf(useScenes.getState(), 'doc-2').objects).toHaveLength(0)
  })

  it('keeps one history per document', () => {
    useScenes.getState().runCommand('doc-1', addObject(box))
    expect(canUndo(historyOf(useScenes.getState(), 'doc-1'))).toBe(true)
    expect(canUndo(historyOf(useScenes.getState(), 'doc-2'))).toBe(false)
  })

  it('undoes and redoes within one document', () => {
    const { runCommand, undo, redo } = useScenes.getState()
    runCommand('doc-1', addObject(box))

    undo('doc-1')
    expect(sceneOf(useScenes.getState(), 'doc-1').objects).toHaveLength(0)
    expect(canRedo(historyOf(useScenes.getState(), 'doc-1'))).toBe(true)

    redo('doc-1')
    expect(sceneOf(useScenes.getState(), 'doc-1').objects).toHaveLength(1)
  })

  it('forgets a scene and its history when the document closes', () => {
    useScenes.getState().runCommand('doc-1', addObject(box))
    useScenes.getState().drop('doc-1')
    expect(useScenes.getState().states['doc-1']).toBeUndefined()
    expect(useScenes.getState().histories['doc-1']).toBeUndefined()
  })
})
