import { describe, expect, it } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from './adjustments'
import {
  cellGridOf,
  createSkyboxContent,
  CROSS_CELLS,
  CROSS_COLUMNS,
  CROSS_ROWS,
  CUBE_FACES,
  DEFAULT_FIELD_OF_VIEW,
  DEFAULT_SUN,
  equirectRectOf,
  FACE_BASES,
  FACE_LABELS,
  faceTilesOf,
  GRID_CELLS,
  GRID_COLUMNS,
  GRID_ROWS,
  isCubeFace,
  isFlatView,
  MAX_FIELD_OF_VIEW,
  MIN_FIELD_OF_VIEW,
  scissorOf,
  SKYBOX_VIEWS,
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

describe('the packed grid', () => {
  it('places every face inside the 3x2 grid, one per cell', () => {
    const cells = CUBE_FACES.map(face => {
      const { column, row } = GRID_CELLS[face]
      expect(column).toBeGreaterThanOrEqual(0)
      expect(column).toBeLessThan(GRID_COLUMNS)
      expect(row).toBeGreaterThanOrEqual(0)
      expect(row).toBeLessThan(GRID_ROWS)
      return `${column},${row}`
    })
    expect(new Set(cells).size).toBe(CUBE_FACES.length)
  })

  it('wastes no cell, which is the only reason it exists beside the cross', () => {
    expect(GRID_COLUMNS * GRID_ROWS).toBe(CUBE_FACES.length)
    expect(CROSS_COLUMNS * CROSS_ROWS).toBeGreaterThan(CUBE_FACES.length)
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

  it('follows the OpenGL cube map axes, which is what a target engine samples', () => {
    // +X is looked at from the origin, so its picture runs towards -Z as it goes right; the two
    // sky faces are the ones whose "up" leaves Y, and they leave it in opposite directions.
    expect(FACE_BASES.px.right).toEqual([0, 0, -1])
    expect(FACE_BASES.nz.right).toEqual([-1, 0, 0])
    expect(FACE_BASES.py.up).toEqual([0, 0, -1])
    expect(FACE_BASES.ny.up).toEqual([0, 0, 1])
  })

  it('keeps the four horizontal faces upright', () => {
    const horizontal: CubeFace[] = ['px', 'nx', 'pz', 'nz']
    for (const face of horizontal) expect(FACE_BASES[face].up).toEqual([0, 1, 0])
  })
})

describe('the flat layouts', () => {
  it('calls every view flat but the immersive one', () => {
    expect(SKYBOX_VIEWS.filter(isFlatView)).toEqual(['equirect', 'cross', 'faces'])
  })

  it('sizes cells in whole pixels and centres what is left over', () => {
    expect(cellGridOf(4, 3, 1000, 800)).toEqual({ cell: 250, x: 0, y: 25 })
    // 700/3 is 233.33: the cell is floored, and the 68 pixels it frees are split either side.
    expect(cellGridOf(4, 3, 1000, 700)).toEqual({ cell: 233, x: 34, y: 0 })
  })

  it('reports a zero cell for a frame too small to hold one', () => {
    expect(cellGridOf(4, 3, 3, 2).cell).toBe(0)
    expect(faceTilesOf('cross', 3, 2)).toEqual([])
  })

  it('lays the equirectangular picture at its own 2:1, centred', () => {
    expect(equirectRectOf(1000, 800)).toEqual({ x: 0, y: 150, width: 1000, height: 500 })
    // A 5:1 frame is wider than the picture, so the height decides and the slack goes sideways.
    expect(equirectRectOf(2000, 400)).toEqual({ x: 600, y: 0, width: 800, height: 400 })
  })

  it('tiles the faces in the order they are named, square and disjoint', () => {
    const tiles = faceTilesOf('faces', 900, 600)
    expect(tiles.map(tile => tile.face)).toEqual(CUBE_FACES)

    for (const { rect } of tiles) {
      expect(rect.width).toBe(300)
      expect(rect.height).toBe(300)
      expect(rect.x).toBeGreaterThanOrEqual(0)
      expect(rect.y).toBeGreaterThanOrEqual(0)
      expect(rect.x + rect.width).toBeLessThanOrEqual(900)
      expect(rect.y + rect.height).toBeLessThanOrEqual(600)
    }

    const corners = tiles.map(({ rect }) => `${rect.x},${rect.y}`)
    expect(new Set(corners).size).toBe(CUBE_FACES.length)
  })

  it('puts the sky above the front face and the ground below it, on the cross', () => {
    const tiles = faceTilesOf('cross', 800, 600)
    const rectOf = (face: CubeFace): { x: number; y: number } => {
      const found = tiles.find(tile => tile.face === face)
      if (!found) throw new Error(`no tile for ${face}`)
      return found.rect
    }

    expect(rectOf('py').y).toBeLessThan(rectOf('pz').y)
    expect(rectOf('ny').y).toBeGreaterThan(rectOf('pz').y)
    expect(rectOf('py').x).toBe(rectOf('pz').x)
    expect(rectOf('nx').x).toBeLessThan(rectOf('pz').x)
    expect(rectOf('px').x).toBeGreaterThan(rectOf('pz').x)
  })

  it('flips a rectangle onto the axis WebGL measures from, and back again', () => {
    const rect = { x: 10, y: 20, width: 100, height: 50 }
    expect(scissorOf(rect, 600)).toEqual({ x: 10, y: 530, width: 100, height: 50 })
    expect(scissorOf(scissorOf(rect, 600), 600)).toEqual(rect)
  })

  it('keeps the top row of a layout at the top once flipped', () => {
    const tiles = faceTilesOf('cross', 800, 600)
    const skyward = tiles.find(tile => tile.face === 'py')
    const groundward = tiles.find(tile => tile.face === 'ny')
    if (!skyward || !groundward) throw new Error('the cross lost a vertical face')

    expect(scissorOf(skyward.rect, 600).y).toBeGreaterThan(scissorOf(groundward.rect, 600).y)
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
