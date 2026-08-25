import { describe, expect, it } from 'vitest'
import { Box3, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'
import { gizmoSizeFor, heldRadius, screenFactor } from './gizmoSize'

/** What `TransformControls` scales its rings by, and so what their radius on stage comes to. */
const radiusOnStage = (size: number, factor: number) => (factor * size) / 4

describe('gizmoSizeFor', () => {
  // The whole point: a small object is no longer wrapped in handles several times its width.
  it('never lets the handles grow wider than what they hold', () => {
    const factor = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 10), new Vector3())

    expect(radiusOnStage(gizmoSizeFor(0.5, 0.2, factor), factor)).toBeCloseTo(0.2)
  })

  it('keeps the preferred size while the object is the bigger of the two', () => {
    const factor = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 2), new Vector3())

    expect(gizmoSizeFor(0.5, 50, factor)).toBe(0.5)
  })

  /**
   * A light and a camera have no geometry, so their box measures nothing. Capped on that, their
   * handles would collapse to a point and there would be no way to move either.
   */
  it('leaves a node with nothing to measure at the preferred size', () => {
    expect(gizmoSizeFor(0.5, 0, 12)).toBe(0.5)
  })

  // Pulling back raises the factor, which is what used to hold the screen size constant — and is
  // now what shrinks the handles alongside the object they are capped to.
  it('shrinks as the camera pulls away, once the cap is what decides', () => {
    const near = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 5), new Vector3())
    const far = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 50), new Vector3())

    expect(gizmoSizeFor(0.5, 0.2, far)).toBeLessThan(gizmoSizeFor(0.5, 0.2, near))
  })
})

describe('heldRadius', () => {
  it('measures half the diagonal of what is held', () => {
    const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1))

    expect(heldRadius(box, new Vector3())).toBeCloseTo(Math.sqrt(12) / 2)
  })

  it('answers nothing for a node that has no geometry at all', () => {
    expect(heldRadius(new Box3(), new Vector3())).toBe(0)
  })
})

describe('screenFactor', () => {
  it('follows the distance under a perspective camera', () => {
    const lens = new PerspectiveCamera(60)
    const at = new Vector3()

    expect(screenFactor(lens, new Vector3(0, 0, 20), at)).toBeCloseTo(
      2 * screenFactor(lens, new Vector3(0, 0, 10), at),
    )
  })

  // An orthographic camera zooms by scaling its frustum and never by moving, so distance says
  // nothing there — reading it would cap the handles on a number that does not change.
  it('reads the frustum under an orthographic one, never the distance', () => {
    const flat = new OrthographicCamera(-2, 2, 1, -1)

    expect(screenFactor(flat, new Vector3(0, 0, 500), new Vector3())).toBe(2)
  })
})
