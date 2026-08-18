import { describe, expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { aspectLoan } from './aspectLoan'

const square = (): PerspectiveCamera => new PerspectiveCamera(50, 1, 0.1, 100)

describe('a pass that borrows the aspect of a camera', () => {
  // A camera of the scene draws the film, the corner preview and its own frustum: a 1:1 film
  // that walked away left the helper stretched until the next layout.
  it('gives the frustum back the way it found it', () => {
    const camera = square()
    const loan = aspectLoan(1920, 1080)

    loan.frame(camera)
    expect(camera.aspect).toBeCloseTo(16 / 9, 5)

    loan.restore()
    expect(camera.aspect).toBe(1)
    expect(camera.projectionMatrix.elements[0]).toBeCloseTo(square().projectionMatrix.elements[0], 5)
  })

  // A film hands over to a second camera mid-way, and the first one is never framed again.
  it('holds what each camera came in with, not what the last one had', () => {
    const first = square()
    const second = new PerspectiveCamera(50, 2, 0.1, 100)
    const loan = aspectLoan(1000, 1000)

    loan.frame(first)
    loan.frame(second)
    loan.frame(first)
    loan.restore()

    expect(first.aspect).toBe(1)
    expect(second.aspect).toBe(2)
  })
})
