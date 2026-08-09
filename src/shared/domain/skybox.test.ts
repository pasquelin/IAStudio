import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from './adjustments'
import {
  createSkyboxContent,
  CROSS_CELLS,
  CROSS_COLUMNS,
  CROSS_ROWS,
  CUBE_FACES,
  DEFAULT_FACE_SIZE,
  DEFAULT_FIELD_OF_VIEW,
  DEFAULT_SUN,
  FACE_BASES,
  FACE_LABELS,
  FACE_SIZES,
  faceFileNames,
  isCubeFace,
  MAX_FIELD_OF_VIEW,
  MIN_FIELD_OF_VIEW,
  type CubeFace,
  type FaceAxis,
} from './skybox'

describe('cube faces', () => {
  it('lists the six faces in the order three.js stores them', () => {
    expect(CUBE_FACES).toEqual(['px', 'nx', 'py', 'ny', 'pz', 'nz'])
  })

  it('recognises the declared faces and nothing else', () => {
    expect(isCubeFace('px')).toBe(true)
    expect(isCubeFace('nz')).toBe(true)
    expect(isCubeFace('top')).toBe(false)
    expect(isCubeFace(undefined)).toBe(false)
  })

  it('labels every face, and never twice the same', () => {
    const labels = CUBE_FACES.map(face => FACE_LABELS[face])
    expect(labels).toEqual(['Rt', 'Lf', 'Up', 'Dn', 'Ft', 'Bk'])
    expect(new Set(labels).size).toBe(CUBE_FACES.length)
  })

  it('names the axes the way an engine reads them', () => {
    expect(FACE_LABELS.px).toBe('Rt')
    expect(FACE_LABELS.py).toBe('Up')
    expect(FACE_LABELS.pz).toBe('Ft')
  })
})

describe('the unfolded cross', () => {
  it('places every face inside the 4x3 grid', () => {
    for (const face of CUBE_FACES) {
      const { column, row } = CROSS_CELLS[face]
      expect(column).toBeGreaterThanOrEqual(0)
      expect(column).toBeLessThan(CROSS_COLUMNS)
      expect(row).toBeGreaterThanOrEqual(0)
      expect(row).toBeLessThan(CROSS_ROWS)
    }
  })

  it('never puts two faces in the same cell', () => {
    const cells = CUBE_FACES.map(face => `${CROSS_CELLS[face].column},${CROSS_CELLS[face].row}`)
    expect(new Set(cells).size).toBe(CUBE_FACES.length)
  })

  it('lays the four horizontal faces on one row, up above and down below', () => {
    const middle: CubeFace[] = ['nx', 'pz', 'px', 'nz']
    for (const face of middle) expect(CROSS_CELLS[face].row).toBe(1)
    expect(CROSS_CELLS.py.row).toBeLessThan(CROSS_CELLS.pz.row)
    expect(CROSS_CELLS.ny.row).toBeGreaterThan(CROSS_CELLS.pz.row)
  })

  it('keeps the vertical faces in the column the front face occupies', () => {
    expect(CROSS_CELLS.py.column).toBe(CROSS_CELLS.pz.column)
    expect(CROSS_CELLS.ny.column).toBe(CROSS_CELLS.pz.column)
  })

  it('orders the horizontal row left, front, right, back', () => {
    expect(CROSS_CELLS.nx.column).toBeLessThan(CROSS_CELLS.pz.column)
    expect(CROSS_CELLS.pz.column).toBeLessThan(CROSS_CELLS.px.column)
    expect(CROSS_CELLS.px.column).toBeLessThan(CROSS_CELLS.nz.column)
  })
})

describe('the face bases', () => {
  // A cross product of unit axes produces negative zeros, and `toEqual` tells those from zero:
  // the assertion is about a direction, not about the sign of nothing.
  const zeroed = (value: number): number => (value === 0 ? 0 : value)

  const cross = (a: FaceAxis, b: FaceAxis): FaceAxis => [
    zeroed(a[1] * b[2] - a[2] * b[1]),
    zeroed(a[2] * b[0] - a[0] * b[2]),
    zeroed(a[0] * b[1] - a[1] * b[0]),
  ]

  const dot = (a: FaceAxis, b: FaceAxis): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

  it('gives every face a right-handed orthonormal basis', () => {
    for (const face of CUBE_FACES) {
      const { forward, right, up } = FACE_BASES[face]
      expect(dot(right, right)).toBe(1)
      expect(dot(up, up)).toBe(1)
      expect(dot(forward, forward)).toBe(1)
      expect(dot(right, up)).toBe(0)
      // Derived rather than restated: a table typed by hand is exactly where a face ends up
      // mirrored, and the type system cannot see it.
      expect(cross(right, up)).toEqual(forward)
    }
  })

  it('points each face down its own axis, and never down another', () => {
    expect(FACE_BASES.px.forward).toEqual([1, 0, 0])
    expect(FACE_BASES.nx.forward).toEqual([-1, 0, 0])
    expect(FACE_BASES.py.forward).toEqual([0, 1, 0])
    expect(FACE_BASES.ny.forward).toEqual([0, -1, 0])
    expect(FACE_BASES.pz.forward).toEqual([0, 0, 1])
    expect(FACE_BASES.nz.forward).toEqual([0, 0, -1])
  })

  /**
   * The one that was wrong on screen. Four of the six faces are a horizon with sky above and
   * ground below, and a horizon reads as a horizon upside down — so nothing in the picture says
   * the vertical has been flipped. It has to be asserted here or not at all.
   */
  it('keeps the four horizontal faces upright', () => {
    const horizontal: CubeFace[] = ['px', 'nx', 'pz', 'nz']
    for (const face of horizontal) expect(FACE_BASES[face].up).toEqual([0, 1, 0])
  })

  it('unfolds the two vertical faces away from the front one, each its own way', () => {
    // Up hinges on the top edge of the front face and Down on its bottom edge: their pictures
    // run opposite ways, and giving them the same `up` folds the cube inside out.
    expect(FACE_BASES.py.up).toEqual([0, 0, -1])
    expect(FACE_BASES.ny.up).toEqual([0, 0, 1])
    expect(FACE_BASES.py.right).toEqual(FACE_BASES.ny.right)
  })

  it('follows the OpenGL cube map axes, which is what a target engine samples', () => {
    // +X is looked at from the origin, so its picture runs towards -Z as it goes right.
    expect(FACE_BASES.px.right).toEqual([0, 0, -1])
    expect(FACE_BASES.nz.right).toEqual([-1, 0, 0])
  })
})

describe('the files an export writes', () => {
  it('names one file per face, by the two letters an importer matches on', () => {
    const files = faceFileNames('Coucher de soleil')

    expect(files.map(file => file.face)).toEqual(CUBE_FACES)
    expect(files.map(file => file.name)).toEqual([
      'Coucher de soleil_Rt',
      'Coucher de soleil_Lf',
      'Coucher de soleil_Up',
      'Coucher de soleil_Dn',
      'Coucher de soleil_Ft',
      'Coucher de soleil_Bk',
    ])
  })

  it('carries no extension: that belongs to whoever writes the file', () => {
    for (const file of faceFileNames('Ciel')) expect(file.name).not.toContain('.')
  })

  it('offers the default size among the ones it offers', () => {
    expect(FACE_SIZES).toContain(DEFAULT_FACE_SIZE)
    // Powers of two, because a cube map is sampled by hardware that assumes it.
    for (const size of FACE_SIZES) expect(Math.log2(size) % 1).toBe(0)
  })
})

describe('the default sun', () => {
  it('starts above the horizon, or the first frame of a new document is unlit', () => {
    expect(DEFAULT_SUN.elevation).toBeGreaterThan(0)
    expect(DEFAULT_SUN.elevation).toBeLessThan(Math.PI / 2)
  })
})

describe('the field of view range', () => {
  it('keeps the default inside the offered range', () => {
    expect(DEFAULT_FIELD_OF_VIEW).toBeGreaterThanOrEqual(MIN_FIELD_OF_VIEW)
    expect(DEFAULT_FIELD_OF_VIEW).toBeLessThanOrEqual(MAX_FIELD_OF_VIEW)
  })
})

describe('a new document', () => {
  it('opens neutral, unlinked and lit', () => {
    const content = createSkyboxContent()
    expect(content.source).toBeNull()
    expect(content.adjustments).toEqual(NEUTRAL_ADJUSTMENTS)
    expect(content.sun).toEqual(DEFAULT_SUN)
    expect(content.environment.showBackground).toBe(true)
  })

  it('copies the defaults rather than sharing them', () => {
    const content = createSkyboxContent()
    content.adjustments.exposure = 2
    content.sun.intensity = 9
    expect(NEUTRAL_ADJUSTMENTS.exposure).toBe(0)
    expect(DEFAULT_SUN.intensity).toBe(1)
    expect(createSkyboxContent().adjustments.exposure).toBe(0)
  })
})
