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
  FACE_LABELS,
  FACE_SIZES,
  faceFileNames,
  isCubeFace,
  MAX_FIELD_OF_VIEW,
  MIN_FIELD_OF_VIEW,
  type CubeFace,
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
