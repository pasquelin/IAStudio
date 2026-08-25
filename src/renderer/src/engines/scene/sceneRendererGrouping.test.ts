import { describe, expect, it } from 'vitest'
import source from './SceneRenderer.ts?raw'

/**
 * What decides whether the repeated shapes are drawn in one call or ten thousand.
 *
 * Read as text for the reason `sceneRendererRedraw` is: the engine cannot be built without a
 * WebGL context, and this is the ABSENCE of a call — the grouping used to live inside
 * `reportStats`, past its two early returns, so it ran only while the statistics overlay was on.
 * Every gate stayed green on that: the instances were correct whenever they existed at all.
 */
describe('SceneRenderer and the grouping of repeated shapes', () => {
  const body = (name: string): string =>
    new RegExp(`private ${name}\\(\\): void \\{[\\s\\S]*?\\n {2}\\}`).exec(source)?.[0] ?? ''

  it('groups outside the switch that only turns the counters off', () => {
    // Turning statistics off gives back a walk over every geometry. It must not also stop the
    // scene being drawn in one call, and it must not leave meshes hidden with nothing drawing
    // them — `rebuild` is the only thing that ever hands a mesh back to the camera.
    expect(body('reportStats')).not.toContain('instances.rebuild')
    expect(body('regroupInstances')).toContain('instances.rebuild')
    expect(body('regroupInstances')).not.toContain('view.stats')
  })

  it('groups against the visibility the viewport really shows', () => {
    // `asDocumented` puts an isolation aside for the length of a call. The grouping reads
    // `visible` off the objects, so run under it, an isolated scene would come back drawn.
    expect(body('regroupInstances')).not.toContain('asDocumented')
  })

  it('never marks one of the two content flags without the other', () => {
    // They are read by different passes and cleared separately, so a bare assignment leaves the
    // other stale — and a stale grouping shows the scene frozen where it stood.
    const bare = source
      .replace(body('markContentChanged'), '')
      .split('\n')
      .map((line, at) => ({ line: line.trim(), at: at + 1 }))
      .filter(({ line }) => line === 'this.contentChanged = true')

    expect(bare).toEqual([])
    expect(body('markContentChanged')).toContain('this.groupingStale = true')
  })
})
