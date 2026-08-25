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
  it('gives the gizmo the size the settings hold, never a constant', () => {
    expect(source).toContain('this.gizmo.size = this.view.gizmoSize')
  })

  /**
   * On BUILD and on every `configure`. Applied only where the gizmo is built, a size changed in
   * the preferences would wait for the next selection to be seen — and applied only on
   * `configure`, a gizmo rebuilt after a detach would come back at the library's own default.
   */
  it('applies it in both places, or the setting is half-heard', () => {
    // Two CALLS — the third occurrence is the declaration, which is why this reads `this.`.
    expect(source.match(/this\.applyGizmoSize\(\)/g)).toHaveLength(2)
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
