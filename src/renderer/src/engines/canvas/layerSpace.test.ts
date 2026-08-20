import { Container } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { IDENTITY, type Transform } from './canvasState'
import { applyTo, compose, invert, layerMatrix, mapRect, type Affine } from './layerSpace'

const BOX = { width: 200, height: 120 }

const moved = (patch: Partial<Transform>): Transform => ({ ...IDENTITY, ...patch })

/**
 * Pixi's own composition, driven exactly as `CanvasEngine.place` drives it. Real Pixi rather than
 * the double the engine's tests use: `Container` computes its local transform in plain
 * arithmetic, so it runs under jsdom, and it is the only witness that can catch a formula that
 * drifts from the renderer's — an upgrade being the way that happens.
 */
function pixiMatrix(transform: Transform, box: { width: number; height: number }): Affine {
  const pivotX = transform.originX * box.width
  const pivotY = transform.originY * box.height

  const node = new Container()
  node.pivot.set(pivotX, pivotY)
  node.position.set(transform.x + pivotX, transform.y + pivotY)
  node.rotation = transform.rotation
  node.scale.set(transform.scaleX, transform.scaleY)
  node.skew.set(transform.skewX, transform.skewY)
  node.updateLocalTransform()

  const { a, b, c, d, tx, ty } = node.localTransform
  return { a, b, c, d, tx, ty }
}

const CASES: readonly { name: string; transform: Transform }[] = [
  { name: 'an untouched layer', transform: IDENTITY },
  { name: 'a moved layer', transform: moved({ x: 37, y: -12 }) },
  { name: 'a scaled layer', transform: moved({ scaleX: 2, scaleY: 0.5 }) },
  { name: 'a mirrored layer', transform: moved({ scaleX: -1, x: 200 }) },
  { name: 'a quarter turn', transform: moved({ rotation: Math.PI / 2 }) },
  { name: 'a skewed layer', transform: moved({ skewX: 0.2, skewY: -0.35 }) },
  { name: 'a corner origin', transform: moved({ originX: 0, originY: 1, x: 15 }) },
  {
    name: 'all of them at once',
    transform: moved({
      x: -40,
      y: 90,
      scaleX: 1.7,
      scaleY: -0.8,
      rotation: 0.9,
      skewX: 0.15,
      skewY: 0.25,
      originX: 0.25,
      originY: 0.75,
    }),
  },
]

describe('layer space', () => {
  describe.each(CASES)('$name', ({ transform }) => {
    it('places its pixels where Pixi places the sprite', () => {
      const ours = layerMatrix(transform, BOX)
      const theirs = pixiMatrix(transform, BOX)

      expect(ours.a).toBeCloseTo(theirs.a, 10)
      expect(ours.b).toBeCloseTo(theirs.b, 10)
      expect(ours.c).toBeCloseTo(theirs.c, 10)
      expect(ours.d).toBeCloseTo(theirs.d, 10)
      expect(ours.tx).toBeCloseTo(theirs.tx, 10)
      expect(ours.ty).toBeCloseTo(theirs.ty, 10)
    })

    it('maps a document point back onto the pixel that draws it', () => {
      const forward = layerMatrix(transform, BOX)
      const back = invert(forward)
      if (!back) throw new Error('the fixtures are all invertible')

      // The brush's contract in one line: paint at a document point, and the texel that lands
      // there is the one the sprite shows under the cursor.
      const texel = { x: 64, y: 48 }
      const onScreen = applyTo(forward, texel)
      const painted = applyTo(back, onScreen)

      expect(painted.x).toBeCloseTo(texel.x, 8)
      expect(painted.y).toBeCloseTo(texel.y, 8)
    })
  })

  describe('composing two maps', () => {
    const moving = layerMatrix(moved({ x: 10, y: 20 }), BOX)
    const turning = layerMatrix(moved({ rotation: Math.PI / 2 }), BOX)

    it('takes a point through both, in order', () => {
      const point = { x: 7, y: 3 }
      const stepByStep = applyTo(moving, applyTo(turning, point))

      expect(applyTo(compose(moving, turning), point)).toEqual(stepByStep)
    })

    it('is the identity when a map meets its own inverse', () => {
      // This is the merge in one line: place the upper layer's pixels in the document, then take
      // them back into the lower layer's own — the pair has to cancel where the two agree.
      const back = invert(turning)
      if (!back) throw new Error('a quarter turn is invertible')
      const round = compose(back, turning)

      expect(round.a).toBeCloseTo(1, 10)
      expect(round.d).toBeCloseTo(1, 10)
      expect(round.tx).toBeCloseTo(0, 10)
      expect(round.ty).toBeCloseTo(0, 10)
    })

    it('does not commute, so the order is the contract', () => {
      const point = { x: 7, y: 3 }
      const one = applyTo(compose(moving, turning), point)
      const other = applyTo(compose(turning, moving), point)

      expect(one).not.toEqual(other)
    })
  })

  it('has no inverse for a layer crushed onto a line', () => {
    // Not a curiosity: painting through a singular map writes NaN over the whole texture, which
    // no undo brings back. The caller has to see `null` and decline the stroke.
    expect(invert(layerMatrix(moved({ scaleX: 0 }), BOX))).toBeNull()
    expect(invert(layerMatrix(moved({ scaleY: 0 }), BOX))).toBeNull()
  })

  it('declines a matrix that has already gone non-finite', () => {
    expect(invert({ a: Number.NaN, b: 0, c: 0, d: 1, tx: 0, ty: 0 })).toBeNull()
  })

  it('shifts a rectangle by a move', () => {
    const matrix = layerMatrix(moved({ x: 10, y: 20 }), BOX)
    expect(mapRect(matrix, { x: 0, y: 0, width: 30, height: 40 })).toEqual({
      x: 10,
      y: 20,
      width: 30,
      height: 40,
    })
  })

  it('bounds a turned rectangle by its corners, not by its size', () => {
    // A quarter turn swaps the sides. Scaling the origin and the size instead would leave the
    // box the shape it was, and the tiles under half the stroke would never be photographed.
    const matrix = layerMatrix(moved({ rotation: Math.PI / 2 }), BOX)
    const box = mapRect(matrix, { x: 0, y: 0, width: 30, height: 40 })

    expect(box.width).toBeCloseTo(40, 8)
    expect(box.height).toBeCloseTo(30, 8)
  })
})
