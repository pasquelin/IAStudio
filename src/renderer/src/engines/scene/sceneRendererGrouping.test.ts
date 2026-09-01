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
    new RegExp(`private ${name}\\([^)]*\\): [\\w<>[\\]| ]+ \\{[\\s\\S]*?\\n {2}\\}`).exec(
      source,
    )?.[0] ?? ''

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

  it('answers a node that only moved without grouping everything again', () => {
    // A rebuild of 40 000 nodes costs 32.7 ms; rewriting the slots that moved costs 3.5 µs. Both
    // paths live here, and a `regroupInstances` that lost one would silently take the other.
    expect(body('regroupInstances')).toContain('instances.rebuild')
    expect(body('regroupInstances')).toContain('instances.moved')
  })

  it('never lets a changed node mark neither the grouping nor its own slot', () => {
    // Marked as neither, a node keeps the matrix the last grouping wrote — it stands where it
    // stood, and nothing rebuilds it. `syncNode` is the one place that may tell the two apart.
    const settled = source
      .replace(body('markContentChanged'), '')
      .replace(body('syncNode'), '')
      .split('\n')
      .map((line, at) => ({ line: line.trim(), at: at + 1 }))
      .filter(({ line }) => line === 'this.contentChanged = true')

    expect(settled).toEqual([])
    expect(body('syncNode')).toContain('keepsItsGroup')
    expect(body('syncNode')).toContain('this.movedNodes.add')
    expect(body('markContentChanged')).toContain('this.groupingStale = true')
  })

  it('picks through the lots, and names a hit by its slot before its source', () => {
    // A lot names the body a ray met by `batchId`; its source, kept where the camera never looks, is met
    // too and names itself. Left out of the targets, the tree built for the lot serves nobody.
    expect(body('nodeAt')).toContain('this.instances.pickable()')
    expect(body('nodeAt')).toContain('this.instances.nodeIdOf(hit) ??')
  })

  it('dresses the meshes it draws with, and not only the ones it stands for', () => {
    // A display mode REPLACES a mesh's material. The instance was left out of that walk, so
    // sixty-four copies drew shaded inside a solid view — and every gate stayed green.
    expect(body('dressPane')).toContain('this.dressable()')
    expect(source).toContain('yield* this.instances.drawn()')
    expect(body('regroupInstances')).toContain('forgetDress(this.paneMemory)')
  })
})
