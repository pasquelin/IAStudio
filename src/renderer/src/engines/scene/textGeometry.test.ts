import { describe, expect, it } from 'vitest'
import type { Font, PathCommand } from 'opentype.js'
import type { TextDescriptor } from '@shared/domain/scene'
import { textGeometry, textShapes } from './textGeometry'

/**
 * A face that draws one thing, whatever it is asked for. Written by hand rather than parsed from
 * a file: the renderer project has no filesystem, and what is under test is the conversion, not
 * `opentype.js` — which is exercised against the three faces the studio ships in
 * `main/fonts/sfnt.test.ts`.
 *
 * The coordinates are in `opentype.js`'s own frame, where `y` grows downward: a glyph above the
 * baseline is at negative `y`, which is exactly the flip these tests are about.
 */
function faceDrawing(commands: readonly PathCommand[]): Font {
  return {
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    getAdvanceWidth: () => 10,
    getPath: () => ({ commands: [...commands] }),
  }
}

/** A ring: an outer square with a square counter inside it, as an `o` is. */
const RING: readonly PathCommand[] = [
  { type: 'M', x: 0, y: 0 },
  { type: 'L', x: 10, y: 0 },
  { type: 'L', x: 10, y: -10 },
  { type: 'L', x: 0, y: -10 },
  { type: 'Z' },
  { type: 'M', x: 2, y: -2 },
  { type: 'L', x: 2, y: -8 },
  { type: 'L', x: 8, y: -8 },
  { type: 'L', x: 8, y: -2 },
  { type: 'Z' },
]

const SQUARE: readonly PathCommand[] = [
  { type: 'M', x: 0, y: 0 },
  { type: 'L', x: 4, y: 0 },
  { type: 'L', x: 4, y: -4 },
  { type: 'L', x: 0, y: -4 },
  { type: 'Z' },
]

const described = (overrides: Partial<TextDescriptor> = {}): TextDescriptor => ({
  value: 'o',
  font: { source: 'embedded', family: 'Lato' },
  size: 1,
  depth: 0.2,
  curveSegments: 4,
  ...overrides,
})

describe('the contours of a run', () => {
  // `ShapePath.toShapes` decides nesting by point-in-polygon rather than by winding, so a counter
  // is found whichever way the face happens to wind it.
  it('reads a counter as a hole rather than as a second letter', () => {
    const shapes = textShapes(faceDrawing(RING), 'o', 1)

    expect(shapes).toHaveLength(1)
    expect(shapes[0]?.holes).toHaveLength(1)
  })

  it('turns two separate contours into two shapes', () => {
    const commands = [...SQUARE, ...SQUARE.map(shift)]

    expect(textShapes(faceDrawing(commands), 'ii', 1)).toHaveLength(2)
  })

  /**
   * `opentype.js` draws with `y` growing downward, as a screen does and as nothing in a scene
   * does. Unflipped, every letter would stand below the grid and read as its own mirror.
   */
  it('stands the letters above the baseline, not below it', () => {
    const points = textShapes(faceDrawing(SQUARE), 'i', 1)[0]?.getPoints() ?? []

    expect(points.length).toBeGreaterThan(0)
    expect(points.every(point => point.y >= 0)).toBe(true)
    expect(Math.max(...points.map(point => point.y))).toBeCloseTo(4)
  })

  it('carries the control points of a curve through the same flip', () => {
    const curved: readonly PathCommand[] = [
      { type: 'M', x: 0, y: 0 },
      { type: 'Q', x1: 5, y1: -10, x: 10, y: 0 },
      { type: 'C', x1: 8, y1: -4, x2: 2, y2: -4, x: 0, y: 0 },
      { type: 'Z' },
    ]

    const points = textShapes(faceDrawing(curved), 'n', 1)[0]?.getPoints(8) ?? []

    expect(points.some(point => point.y > 0)).toBe(true)
    expect(points.every(point => point.y >= -0.001)).toBe(true)
  })

  it('draws nothing at all for an empty run', () => {
    expect(textShapes(faceDrawing([]), '', 1)).toHaveLength(0)
  })
})

describe('the solid a run becomes', () => {
  it('extrudes the contours into something with vertices', () => {
    const geometry = textGeometry(faceDrawing(RING), described())

    expect(geometry.getAttribute('position').count).toBeGreaterThan(0)
  })

  // So a text sits on the grid it was dropped onto, and typing a descender does not make what is
  // already written jump.
  it('centres it across its width and its thickness, baseline on the origin', () => {
    const geometry = textGeometry(faceDrawing(SQUARE), described({ depth: 0.4 }))
    geometry.computeBoundingBox()
    const bounds = geometry.boundingBox

    expect(bounds?.min.x).toBeCloseTo(-2)
    expect(bounds?.max.x).toBeCloseTo(2)
    expect(bounds?.min.y).toBeCloseTo(0)
    expect(bounds?.min.z).toBeCloseTo(-0.2)
    expect(bounds?.max.z).toBeCloseTo(0.2)
  })

  it('stands out by the depth it was given', () => {
    const geometry = textGeometry(faceDrawing(SQUARE), described({ depth: 1 }))
    geometry.computeBoundingBox()

    expect((geometry.boundingBox?.max.z ?? 0) - (geometry.boundingBox?.min.z ?? 0)).toBeCloseTo(1)
  })

  // An empty caption is what a text node holds while its face is still on its way: it must
  // build, draw nothing, and leave no NaN behind in the box every framing and gizmo reads.
  it('builds an empty solid for an empty run, rather than failing', () => {
    const geometry = textGeometry(faceDrawing([]), described({ value: '' }))
    geometry.computeBoundingBox()

    expect(geometry.getAttribute('position')?.count ?? 0).toBe(0)
    expect(Number.isNaN(geometry.boundingBox?.min.x)).toBe(false)
  })
})

/** Moves a contour sideways, so two of them are two shapes rather than one drawn twice. */
function shift(command: PathCommand): PathCommand {
  if (command.type === 'Z') return command
  if (command.type === 'Q') return { ...command, x1: command.x1 + 6, x: command.x + 6 }
  if (command.type === 'C') {
    return { ...command, x1: command.x1 + 6, x2: command.x2 + 6, x: command.x + 6 }
  }
  return { ...command, x: command.x + 6 }
}
