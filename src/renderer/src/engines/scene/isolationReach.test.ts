/**
 * The one thing `isolation.ts` promises and cannot enforce on its own: a mask that lives in
 * `Object3D.visible` is a mask the exporter, the statistics and the film all read.
 *
 * Written against the pieces rather than against `SceneRenderer`, which needs a WebGL context —
 * what is asserted here is the CONTRACT the three call sites rest on, and the renderer's own
 * `asDocumented` is the single place that honours it.
 */
import { describe, expect, it } from 'vitest'
import { BoxGeometry, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { statsOf } from './sceneStats'
import { drawsNode, hideIn, NOTHING_ISOLATED, type Isolation } from './isolation'

function stage(): Map<string, Object3D> {
  const shown = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  const hidden = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  return new Map([
    ['a', shown],
    ['b', hidden],
  ])
}

/** What the renderer does: the document's own visibility, with the viewport's mask over it. */
function paint(objects: Map<string, Object3D>, isolation: Isolation, documented: boolean): void {
  for (const [id, object] of objects) object.visible = drawsNode(isolation, id, documented)
}

describe('what an isolation must not reach', () => {
  it('would otherwise take an isolated object out of the counters', () => {
    const objects = stage()

    paint(objects, NOTHING_ISOLATED, true)
    const whole = statsOf(objects.values()).triangles

    paint(objects, hideIn(NOTHING_ISOLATED, ['b']), true)
    expect(statsOf(objects.values()).triangles).toBeLessThan(whole)
  })

  /**
   * And this is why the renderer puts the document's visibility back around every export, film
   * and count: `statsOf` and both glTF exporters read the same flag, and `onlyVisible` makes an
   * amputated file a silent success rather than an error.
   */
  it('counts the whole model again once the document is what is being read', () => {
    const objects = stage()

    paint(objects, NOTHING_ISOLATED, true)
    const whole = statsOf(objects.values()).triangles

    paint(objects, hideIn(NOTHING_ISOLATED, ['b']), true)
    // What `asDocumented` does for the length of a call.
    for (const object of objects.values()) object.visible = true

    expect(statsOf(objects.values()).triangles).toBe(whole)
  })

  it('leaves what the DOCUMENT hides out of the counters, mask or no mask', () => {
    const objects = stage()
    paint(objects, NOTHING_ISOLATED, false)

    expect(statsOf(objects.values()).triangles).toBe(0)
  })
})
