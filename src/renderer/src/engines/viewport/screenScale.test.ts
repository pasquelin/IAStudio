import { describe, expect, it } from 'vitest'
import { Camera, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'
import { screenScale } from './screenScale'

const origin = new Vector3(0, 0, 0)

/** Sixty degrees, so the visible height is 2 tan(30°) — about 1,1547 — times the distance. */
const perspective = (z: number): PerspectiveCamera => {
  const camera = new PerspectiveCamera(60, 1, 0.1, 100)
  camera.position.set(0, 0, z)
  return camera
}

describe('the world size of a constant share of the screen', () => {
  it('grows with the distance, so what is drawn keeps its size', () => {
    expect(screenScale(perspective(10), origin, 0.1)).toBeCloseTo(1.1547, 3)
    expect(screenScale(perspective(20), origin, 0.1)).toBeCloseTo(2.3094, 3)
  })

  it('reads the distance to the POINT, not to where the camera is aimed', () => {
    const camera = perspective(10)
    // Twenty units away from a camera aimed at the origin, so twice the size it has there.
    const behind = screenScale(camera, new Vector3(0, 0, -10), 0.1)

    expect(behind).toBeCloseTo(2.3094, 3)
  })

  // An orthographic view shows the same height wherever a point stands: that is what it is.
  it('holds the same size at any distance for an orthographic view', () => {
    const camera = new OrthographicCamera(-2, 2, 5, -5)

    expect(screenScale(camera, origin, 0.1)).toBeCloseTo(1, 3)
    expect(screenScale(camera, new Vector3(0, 0, -50), 0.1)).toBeCloseTo(1, 3)
  })

  it('follows the zoom of an orthographic view, which is what it shows less of', () => {
    const camera = new OrthographicCamera(-2, 2, 5, -5)
    camera.zoom = 2

    expect(screenScale(camera, origin, 0.1)).toBeCloseTo(0.5, 3)
  })

  // A mark of no size at all would be a mark nobody can click.
  it('leaves a camera of neither kind with the share itself', () => {
    expect(screenScale(new Camera(), origin, 0.1)).toBe(0.1)
  })
})
