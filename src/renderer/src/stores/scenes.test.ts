import { beforeEach, describe, expect, it } from 'vitest'
import { canRedo, canUndo } from '@/engines/core/history'
import { addNode, setTransform } from '@/engines/scene/commands'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, IDENTITY_TRANSFORM } from '@/engines/scene/scene-state'
import { historyOf, sceneOf, useScenes } from './scenes'

const box = meshNode('box-1')

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

describe('gestures', () => {
  const moved = (x: number) => ({ ...IDENTITY_TRANSFORM, position: { x, y: 0, z: 0 } })
  const positionOf = (documentId: string) =>
    sceneOf(useScenes.getState(), documentId).nodes[0]?.transform.position.x

  const drag = (documentId: string, values: number[]) => {
    const store = useScenes.getState()
    store.beginGesture(documentId)
    for (const value of values) store.runCommand(documentId, setTransform('box-1', moved(value)))
    store.endGesture(documentId)
  }

  beforeEach(() => {
    useScenes.setState({ states: { 'doc-1': { nodes: [box], selectedId: null } }, histories: {} })
  })

  it('leaves one history entry for a drag that emitted a value per frame', () => {
    drag('doc-1', [1, 2, 3, 4, 5])

    expect(positionOf('doc-1')).toBe(5)
    expect(historyOf(useScenes.getState(), 'doc-1').past).toHaveLength(1)
  })

  it('undoes the whole drag rather than one frame of it', () => {
    drag('doc-1', [1, 2, 3])
    useScenes.getState().undo('doc-1')

    expect(positionOf('doc-1')).toBe(0)
    expect(canUndo(historyOf(useScenes.getState(), 'doc-1'))).toBe(false)
  })

  // Two drags of the same field are two things the user did, and ⌘Z must give them back one
  // at a time — which is what the gesture, rather than the command id alone, decides.
  it('keeps two successive drags of the same field apart', () => {
    drag('doc-1', [1, 2])
    drag('doc-1', [8, 9])

    expect(historyOf(useScenes.getState(), 'doc-1').past).toHaveLength(2)

    useScenes.getState().undo('doc-1')
    expect(positionOf('doc-1')).toBe(2)
  })

  it('merges nothing outside a gesture', () => {
    const store = useScenes.getState()
    store.runCommand('doc-1', setTransform('box-1', moved(1)))
    store.runCommand('doc-1', setTransform('box-1', moved(2)))

    expect(historyOf(useScenes.getState(), 'doc-1').past).toHaveLength(2)
  })

  // ⌘Z mid-drag: the entry the next value would merge into is no longer the one it started from.
  it('closes the gesture an undo interrupts', () => {
    const store = useScenes.getState()
    store.beginGesture('doc-1')
    store.runCommand('doc-1', setTransform('box-1', moved(1)))
    store.undo('doc-1')
    store.runCommand('doc-1', setTransform('box-1', moved(2)))

    expect(positionOf('doc-1')).toBe(2)
    expect(historyOf(useScenes.getState(), 'doc-1').past).toHaveLength(1)
  })

  it('keeps a gesture to the document that opened it', () => {
    const store = useScenes.getState()
    useScenes.setState({
      states: {
        'doc-1': { nodes: [box], selectedId: null },
        'doc-2': { nodes: [box], selectedId: null },
      },
      histories: {},
    })

    store.beginGesture('doc-1')
    store.runCommand('doc-2', setTransform('box-1', moved(1)))
    store.runCommand('doc-2', setTransform('box-1', moved(2)))

    expect(historyOf(useScenes.getState(), 'doc-2').past).toHaveLength(2)
  })
})
