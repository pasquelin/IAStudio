import { describe, expect, it, vi } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { RULER_HEIGHT, type Viewport } from '../timeline/timelineGeometry'
import { animationTrack, timelineWith } from './animation-fixtures'
import { keyId, keyParts, paintAnimation } from './animationPainter'
import { refreshPalette } from '../core/palette'
import type { Point } from '../core/geometry'
import { CLIP_HEIGHT, SUBJECT_HEIGHT, animationRows } from './animationRows'

/** One pixel per 10 ms, so a second is a hundred pixels across. */
const viewport: Viewport = { scale: 100 / SECOND, offset: 0, scrollTop: 0 }
const size = { width: 800, height: 300 }

const key = (seconds: number) => ({ time: seconds * SECOND, value: { x: 0, y: 0, z: 0 } })

type Rect = { x: number; y: number; width: number; height: number }

/** Records what was painted, so the test asserts on shapes and not on pixels. */
function spyContext() {
  const rects: Rect[] = []
  const lines: Point[] = []
  const fills: string[] = []

  const context = {
    font: '',
    textBaseline: '',
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn((x: number, y: number) => void lines.push({ x, y })),
    lineTo: vi.fn((x: number, y: number) => void lines.push({ x, y })),
    fillText: vi.fn(),
    fillRect: vi.fn((x: number, y: number, width: number, height: number) =>
      rects.push({ x, y, width, height }),
    ),
  }

  // Every colour kept: the painter sets one per shape, and reading the property back would only
  // ever show the last.
  Object.defineProperty(context, 'fillStyle', {
    get: () => fills.at(-1) ?? '',
    set: (value: string) => void fills.push(value),
  })

  // jsdom has no usable 2D context; the painter only ever calls these members.
  return { context: context as unknown as CanvasRenderingContext2D, rects, lines, fills }
}

const paintOf = (rows: Parameters<typeof paintAnimation>[1]['rows'], playhead = 0) => {
  const spy = spyContext()
  paintAnimation(
    spy.context,
    { rows, viewport, fps: 25, duration: 5 * SECOND, playhead, selected: new Set() },
    size,
  )
  return spy
}

const rowsOf = (
  tracks: Parameters<typeof timelineWith>[0],
  clips?: Parameters<typeof animationRows>[1]['clips'],
) =>
  animationRows(timelineWith(tracks), {
    nodes: [{ id: 'cube', name: 'Circle' }],
    expanded: new Set(),
    clips,
  })

describe('painting the animation band', () => {
  it('draws a diamond per key — four corners, closed', () => {
    const { lines } = paintOf(rowsOf([animationTrack('a', 'position', [key(1)])]))

    // At one second the key sits a hundred pixels in, on the middle of the first row. The four
    // corners are drawn, never the centre — top and bottom share the x, left and right the y.
    const middle = RULER_HEIGHT + SUBJECT_HEIGHT / 2
    expect(
      lines
        .filter(point => point.x === 100)
        .map(point => point.y)
        .sort(),
    ).toEqual([middle - 4, middle + 4])
    expect(lines.filter(point => point.y === middle)).toHaveLength(2)
  })

  it('draws nothing for a key scrolled off the left edge', () => {
    const far = paintOf(
      rowsOf([animationTrack('a', 'position', [{ ...key(0), time: -9 * SECOND }])]),
    )
    expect(far.lines).toHaveLength(0)
  })

  it('rules the head across the whole height, and only while it is in view', () => {
    const shown = paintOf(rowsOf([animationTrack('a', 'position', [])]), 2 * SECOND)
    expect(shown.rects).toContainEqual({ x: 200.5, y: 0, width: 1, height: size.height })

    // Ten seconds is a thousand pixels in, past an eight-hundred-pixel view.
    const gone = paintOf(rowsOf([animationTrack('a', 'position', [])]), 10 * SECOND)
    expect(gone.rects.some(rect => rect.width === 1 && rect.height === size.height)).toBe(false)
  })

  it('draws a clip as a BAR of its own length, not as a diamond', () => {
    const { rects, lines } = paintOf(
      rowsOf([], [{ nodeId: 'perso', name: 'Walk', start: 1 * SECOND, duration: 2 * SECOND }]),
    )

    // One second in, two hundred pixels wide, inset inside its row — which sits under the
    // subject line the cube always has.
    expect(rects).toContainEqual({
      x: 100,
      y: RULER_HEIGHT + SUBJECT_HEIGHT + 2,
      width: 200,
      height: CLIP_HEIGHT - 5,
    })
    expect(lines).toHaveLength(0)
  })

  it('keeps a zero-length block visible rather than drawing nothing at all', () => {
    const { rects } = paintOf(
      rowsOf([], [{ nodeId: 'perso', name: 'Walk', start: 0, duration: 0 }]),
    )
    expect(rects.some(rect => rect.width === 1 && rect.height === CLIP_HEIGHT - 5)).toBe(true)
  })

  it('paints an empty band without throwing, which is what an untouched scene shows', () => {
    expect(() => paintOf([])).not.toThrow()
  })

  it('reads its colours again once the theme has moved', () => {
    const rows = rowsOf([animationTrack('a', 'position', [key(1)])])
    document.documentElement.style.setProperty('--color-panel', '#123456')
    refreshPalette()

    // Restored even on a failed assertion: the root and the token cache are both shared, so
    // leaking either would fail the NEXT test and accuse the wrong code.
    try {
      expect(paintOf(rows).fills).toContain('#123456')

      document.documentElement.style.setProperty('--color-panel', '#654321')
      refreshPalette()

      // Counting the fills would pass without the drop: the band would go on painting the theme
      // the user has just left, in exactly as many shapes.
      expect(paintOf(rows).fills).toContain('#654321')
    } finally {
      document.documentElement.style.removeProperty('--color-panel')
      refreshPalette()
    }
  })

  it('names a key the same way the selection set does', () => {
    expect(keyId('cube', 2 * SECOND)).toBe('cube@2000000')
  })

  it('reads back what it wrote', () => {
    expect(keyParts(keyId('cube', 2 * SECOND))).toEqual({ rowId: 'cube', time: 2 * SECOND })
  })

  /**
   * The separator is a character a row id may hold — `keyId` puts it in without escaping, so the
   * LAST one is the one that separates. Reading the first would name a row that does not exist,
   * and the key would silently survive the delete.
   */
  it('reads back a row whose name holds the separator', () => {
    expect(keyParts(keyId('rig@arm', SECOND))).toEqual({ rowId: 'rig@arm', time: SECOND })
  })

  /**
   * Whatever is in a selection set is a string; nothing promises it is one of ours. The last
   * three come from a review that mutated `keyParts` until something survived: a time may not
   * be endless, may not carry a unit, and a key with no row before the separator names nothing.
   */
  it('takes nothing from a string that is not a key name', () => {
    expect(keyParts('cube')).toBeUndefined()
    expect(keyParts('cube@')).toBeUndefined()
    expect(keyParts('cube@soon')).toBeUndefined()
    expect(keyParts('cube@Infinity')).toBeUndefined()
    expect(keyParts('cube@2s')).toBeUndefined()
    expect(keyParts('@1000')).toBeUndefined()
  })
})
