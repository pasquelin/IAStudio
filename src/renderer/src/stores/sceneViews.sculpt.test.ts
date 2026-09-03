import { describe, expect, it } from 'vitest'
import { sceneViewOf, useSceneViews } from './sceneViews'

describe('sculpt and pose as exclusive sessions', () => {
  it('drops pose when sculpt is armed', () => {
    useSceneViews.setState({ views: {} })
    useSceneViews.getState().setPoseMode('doc-1', true)
    useSceneViews.getState().setSculptMode('doc-1', true)

    const view = sceneViewOf(useSceneViews.getState(), 'doc-1')
    expect(view.sculptMode).toBe(true)
    expect(view.poseMode).toBe(false)
    expect(view.pickedBone).toBeNull()
  })

  it('drops sculpt when pose is armed', () => {
    useSceneViews.setState({ views: {} })
    useSceneViews.getState().setSculptMode('doc-1', true)
    useSceneViews.getState().setPoseMode('doc-1', true)

    const view = sceneViewOf(useSceneViews.getState(), 'doc-1')
    expect(view.poseMode).toBe(true)
    expect(view.sculptMode).toBe(false)
  })

  it('holds brush radius and falloff on the session, not the document', () => {
    useSceneViews.setState({ views: {} })
    useSceneViews.getState().setSculptRadius('doc-1', 8)
    useSceneViews.getState().setSculptFalloff('doc-1', 0.4)

    const view = sceneViewOf(useSceneViews.getState(), 'doc-1')
    expect(view.sculptRadius).toBe(8)
    expect(view.sculptFalloff).toBe(0.4)
  })
})
