import { describe, expect, it } from 'vitest'
import source from './SceneRenderer.ts?raw'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { boundsOf } from '@shared/domain/settingsRegistry'

/**
 * That the handle size reaches the gizmo at all, read as text: the engine needs a WebGL context
 * to exist, so `sceneRendererRedraw.test.ts` gives the reason this shape of guard is the one
 * available here.
 */
describe('SceneRenderer and the size of its handles', () => {
  it('gives the gizmo a size CAPPED to what it holds, never the setting raw', () => {
    expect(source).toContain('this.gizmo.size = gizmoSizeFor(')
    expect(source).not.toContain('this.gizmo.size = this.view.gizmoSize')
  })

  /**
   * Three CALLS — the fourth occurrence is the declaration. On build, so a gizmo rebuilt after a
   * detach does not come back at the library's default; on `configure`, so a preference is seen
   * without waiting for the next selection; and on every FRAME, because the cap reads the
   * distance and the distance moves on every notch of the wheel.
   */
  it('applies it on build, on configure AND on every frame', () => {
    expect(source.match(/this\.applyGizmoSize\(\)/g)).toHaveLength(3)
  })
})

describe('what the handle size is allowed to be', () => {
  it('opens on half, which is what the library calls one cut in two', () => {
    expect(DEFAULT_SETTINGS.three.gizmoSize).toBe(0.5)
  })

  // The library's own default is 1, and it covered half the view. It stays REACHABLE — somebody
  // who wants it back should not have to edit a file — but it is no longer what the studio opens on.
  it('still reaches the default the library ships with', () => {
    const { min, max } = boundsOf('three.gizmoSize')

    expect(min).toBeLessThan(DEFAULT_SETTINGS.three.gizmoSize)
    expect(max).toBeGreaterThanOrEqual(1)
  })
})
