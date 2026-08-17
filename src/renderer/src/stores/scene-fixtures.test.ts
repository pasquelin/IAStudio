import { beforeEach, describe, expect, it } from 'vitest'
import { renameNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/sceneState'
import { installScene, sceneNodeNow } from './scene-fixtures'
import { useScenes } from './scenes'

const DOCUMENT = 'scene-1'

const sceneOfOne = (name: string): SceneState => ({
  ...EMPTY_SCENE,
  nodes: [{ ...meshNode('box-1'), name }],
})

describe('sceneNodeNow', () => {
  beforeEach(() => {
    installScene(DOCUMENT, sceneOfOne('Base'))
  })

  /**
   * Two scenes have to stand at once for this to be observable: with one installed, reading the
   * wrong document finds nothing, which is what a missing node looks like too — and `installScene`
   * replaces the whole map, so both are set at once rather than installed in turn.
   */
  it('reads the document it is given, not one of its own', () => {
    useScenes.setState({
      states: { [DOCUMENT]: sceneOfOne('Base'), 'scene-2': sceneOfOne('Column') },
    })

    expect(sceneNodeNow('scene-2', 'box-1')?.name).toBe('Column')
    expect(sceneNodeNow(DOCUMENT, 'box-1')?.name).toBe('Base')
  })

  /** What the suites branch on: `null`, never a throw, for a node the scene does not hold. */
  it('answers null for an id the scene does not hold', () => {
    expect(sceneNodeNow(DOCUMENT, 'box-2')).toBeNull()
  })

  /**
   * The same `null` for a document the store never held — the accident `installScene` causes by
   * replacing the whole map. Pinned because it is a silent one: the store's own `EMPTY_SCENE`
   * fallback is what keeps `nodeById` from reading `undefined.nodes` and throwing.
   */
  it('answers null for a document the store does not hold', () => {
    expect(sceneNodeNow('scene-404', 'box-1')).toBeNull()
  })

  /** Read at call time: the suites call it after an edit and expect the edited value. */
  it('reads the store as it stands at the call, not as it stood before', () => {
    const before = sceneNodeNow(DOCUMENT, 'box-1')

    useScenes.getState().runCommand(DOCUMENT, renameNode('box-1', 'Column'))

    expect(before?.name).toBe('Base')
    expect(sceneNodeNow(DOCUMENT, 'box-1')?.name).toBe('Column')
  })
})
