import { describe, expect, it } from 'vitest'
import { Box3, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'
import { gizmoReachOf, gizmoSizeFor, heldRadius, screenFactor, type GizmoMode } from './gizmoSize'

describe('gizmoSizeFor', () => {
  /**
   * The whole point, and what the first attempt got wrong: it took the outermost handle for a
   * radius of one. Nothing in `TransformControls` stands at one — the rotation ring is at 0.75 —
   * so the handles landed a quarter short of the object they were meant to wrap.
   */
  const MODES: readonly GizmoMode[] = ['translate', 'rotate', 'scale']

  it.each(MODES)('lands the outermost handle of %s ON the radius it holds', mode => {
    const factor = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 10), new Vector3())

    expect(gizmoReachOf(gizmoSizeFor(0.5, 0.2, factor, mode), factor, mode)).toBeCloseTo(0.2)
  })

  // A ring reaches further than an arrow, so the same object asks the two modes for two sizes.
  it('asks a rotation for a smaller size than an arrow, for one radius', () => {
    const factor = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 10), new Vector3())

    expect(gizmoSizeFor(9, 0.2, factor, 'rotate')).toBeLessThan(
      gizmoSizeFor(9, 0.2, factor, 'translate'),
    )
  })

  it('keeps the preferred size while the object is the bigger of the two', () => {
    const factor = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 2), new Vector3())

    expect(gizmoSizeFor(0.5, 50, factor, 'rotate')).toBe(0.5)
  })

  /**
   * A light and a camera have no geometry, so their box measures nothing. Capped on that, their
   * handles would collapse to a point and there would be no way to move either.
   */
  it('leaves a node with nothing to measure at the preferred size', () => {
    expect(gizmoSizeFor(0.5, 0, 12, 'rotate')).toBe(0.5)
  })

  // Pulling back raises the factor, which is what used to hold the screen size constant — and is
  // now what shrinks the handles alongside the object they are capped to.
  it('shrinks as the camera pulls away, once the cap is what decides', () => {
    const near = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 5), new Vector3())
    const far = screenFactor(new PerspectiveCamera(60), new Vector3(0, 0, 50), new Vector3())

    expect(gizmoSizeFor(0.5, 0.2, far, 'rotate')).toBeLessThan(
      gizmoSizeFor(0.5, 0.2, near, 'rotate'),
    )
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
