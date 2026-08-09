import { OrthographicCamera, PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'
import { ViewportEngine } from './ViewportEngine'

/**
 * The projection is decided in the constructor and in plain maths, so everything below runs on
 * an engine that was never mounted. `ViewportEngine.test.ts` covers the other half — mounting,
 * the frame loop and disposal — against a renderer standing in for the one jsdom cannot give.
 */
describe('ViewportEngine projection', () => {
  it('draws with the perspective camera until asked otherwise', () => {
    expect(new ViewportEngine().camera).toBeInstanceOf(PerspectiveCamera)
  })

  it('swaps to the orthographic camera, and back', () => {
    const engine = new ViewportEngine()

    engine.setProjection('orthographic')
    expect(engine.camera).toBeInstanceOf(OrthographicCamera)

    engine.setProjection('perspective')
    expect(engine.camera).toBeInstanceOf(PerspectiveCamera)
  })

  // The swap must not move the view: the same set has to stay where the eye left it.
  it('carries the placement over to the camera it swaps to', () => {
    const engine = new ViewportEngine()
    engine.perspective.position.set(3, 4, 5)
    engine.perspective.lookAt(0, 0, 0)

    engine.setProjection('orthographic')

    expect(engine.orthographic.position.toArray()).toEqual([3, 4, 5])
    expect(engine.orthographic.quaternion.equals(engine.perspective.quaternion)).toBe(true)
  })

  /**
   * The frustum stands in for the field of view at the distance the camera sits: a set framed in
   * perspective has to keep its size when the projection changes under it.
   */
  it('sizes the frustum from the field of view and the distance', () => {
    const engine = new ViewportEngine({ fieldOfView: 90 })
    engine.perspective.position.set(0, 0, 10)

    engine.setProjection('orthographic')

    // tan(45°) = 1, so a 90° lens spans twice the distance: ten up, ten down.
    expect(engine.orthographic.top).toBeCloseTo(10, 2)
    expect(engine.orthographic.bottom).toBeCloseTo(-10, 2)
  })

  // Carried over, a zoom from an earlier swap would apply on top of the frustum just sized for it.
  it('resets the zoom the orbit left on the camera', () => {
    const engine = new ViewportEngine()
    engine.orthographic.zoom = 4

    engine.setProjection('orthographic')

    expect(engine.orthographic.zoom).toBe(1)
  })

  /**
   * The wheel is the whole difference between the two cameras: an orthographic one scales its
   * frustum and never moves, a perspective one only moves. Coming back, the zoom was simply
   * dropped — a view zoomed four times in orthographic jumped back out to where it had started.
   */
  it('spends an orthographic zoom as distance when it swaps back to perspective', () => {
    const engine = new ViewportEngine()
    engine.perspective.position.set(0, 0, 12)
    engine.setProjection('orthographic')
    // What the wheel does to an orthographic camera, and the only trace it leaves.
    engine.orthographic.zoom = 4

    engine.setProjection('perspective')

    // Four times closer, because four times nearer is what four times bigger means here.
    expect(engine.perspective.position.z).toBeCloseTo(3, 5)
  })

  // Two axes with different values: a camera on the diagonal would pass either way round.
  it('spends it along the line to the target, not along one axis', () => {
    const engine = new ViewportEngine()
    engine.perspective.position.set(6, 0, 12)
    engine.setProjection('orthographic')
    engine.orthographic.zoom = 2

    engine.setProjection('perspective')

    expect(engine.perspective.position.x).toBeCloseTo(3, 5)
    expect(engine.perspective.position.z).toBeCloseTo(6, 5)
  })

  /**
   * Going the other way there is nothing to spend. The stale orthographic zoom is set on purpose:
   * without it the guard short-circuits on `!== 1` and the direction of the spend is never read,
   * so the test could not see it being dropped.
   */
  it('leaves the placement alone going into orthographic', () => {
    const engine = new ViewportEngine()
    engine.perspective.position.set(3, 4, 5)
    engine.orthographic.zoom = 2

    engine.setProjection('orthographic')

    expect(engine.orthographic.position.toArray()).toEqual([3, 4, 5])
  })

  // A swap the code promises is a no-op must not pull a distant camera in to the clamp band.
  it('moves nothing when there is no zoom to spend', () => {
    const engine = new ViewportEngine()
    engine.perspective.position.set(0, 0, 600)
    engine.setProjection('orthographic')

    engine.setProjection('perspective')

    expect(engine.perspective.position.toArray()).toEqual([0, 0, 600])
  })

  /**
   * A move tells a perspective camera everything; it tells an orthographic one nothing at all.
   * Framing a selection moved the camera and left the screen exactly as it was.
   */
  it('sizes the frustum again for where the camera was moved to', () => {
    const engine = new ViewportEngine({ fieldOfView: 90 })
    engine.perspective.position.set(0, 0, 10)
    engine.setProjection('orthographic')
    engine.orthographic.zoom = 3
    engine.orthographic.position.set(0, 0, 4)

    engine.refit()

    expect(engine.orthographic.zoom).toBe(1)
    // tan(45°) = 1, so a 90° lens spans the distance either side: four up, four down.
    expect(engine.orthographic.top).toBeCloseTo(4, 5)
    expect(engine.orthographic.bottom).toBeCloseTo(-4, 5)
  })

  /**
   * Nothing bounds an orthographic zoom — `minZoom` is 0 and ninety notches of wheel cost nothing
   * there. Spent whole, the distance lands past `far`, the target is clipped, and the viewport is
   * black with no swap that recovers it. A zoom dropped only ever widened the view.
   */
  it('spends no more zoom than the far plane allows', () => {
    const engine = new ViewportEngine()
    engine.perspective.position.set(0, 0, 12)
    engine.setProjection('orthographic')
    engine.orthographic.zoom = 0.0099

    engine.setProjection('perspective')

    expect(engine.perspective.position.length()).toBeLessThanOrEqual(engine.perspective.far / 2)
    expect(engine.perspective.position.length()).toBeGreaterThan(12)
  })

  it('spends no more zoom than the near plane allows', () => {
    const engine = new ViewportEngine()
    engine.perspective.position.set(0, 0, 12)
    engine.setProjection('orthographic')
    engine.orthographic.zoom = 500

    engine.setProjection('perspective')

    expect(engine.perspective.position.length()).toBeGreaterThanOrEqual(engine.perspective.near * 2)
    expect(engine.perspective.position.length()).toBeLessThan(12)
  })

  // `orthographic.zoom` is public, and a zero would divide the placement into infinity.
  it('spends nothing at all when the zoom is not a positive number', () => {
    const engine = new ViewportEngine()
    engine.perspective.position.set(0, 0, 12)
    engine.setProjection('orthographic')
    engine.orthographic.zoom = 0

    engine.setProjection('perspective')

    expect(engine.perspective.position.toArray()).toEqual([0, 0, 12])
  })

  it('does nothing at all when asked for the projection it already draws with', () => {
    const engine = new ViewportEngine()
    engine.orthographic.zoom = 4

    engine.setProjection('perspective')

    expect(engine.orthographic.zoom).toBe(4)
  })

  // The frustum is derived from the field of view, so a settings change has to resize it.
  it('follows a change of field of view', () => {
    const engine = new ViewportEngine({ fieldOfView: 90 })
    engine.perspective.position.set(0, 0, 10)
    engine.setProjection('orthographic')

    engine.setFieldOfView(60)

    expect(engine.orthographic.top).toBeLessThan(10)
  })
})
