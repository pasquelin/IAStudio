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
