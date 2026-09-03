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
})
