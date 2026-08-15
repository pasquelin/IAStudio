import { describe, expect, it } from 'vitest'
import { fromDb } from './audio-data'
import { HOT_DB, RESTING_METER, type MeterState } from './level'
import { paintMeter, type MeterPalette } from './meter-painter'

const palette: MeterPalette = {
  rail: 'rail',
  safe: 'green',
  hot: 'amber',
  peak: 'witness',
  clip: 'red',
}

/** Every rectangle laid down, in order, with the ink it was laid down in. */
const surface = () => {
  const drawn: { ink: string; top: number; height: number }[] = []
  let ink = ''
  const context = {
    fillRect: (_x: number, top: number, _width: number, height: number) =>
      drawn.push({ ink, top, height }),
    set fillStyle(colour: string) {
      ink = colour
    },
  } as unknown as CanvasRenderingContext2D

  return { drawn, context }
}

const paint = (meter: MeterState) => {
  const { drawn, context } = surface()
  paintMeter(context, { width: 12, height: 100 }, meter, palette)
  return drawn
}

describe('the output meter', () => {
  it('shows a rail and nothing else when nothing is playing', () => {
    expect(paint(RESTING_METER).map(band => band.ink)).toEqual(['rail'])
  })

  it('fills from the bottom up, in the calm colour while the sound stays calm', () => {
    const [rail, bar] = paint({ ...RESTING_METER, level: fromDb(-24), peak: fromDb(-24) })

    expect(bar?.ink).toBe('green')
    // Standing ON the bottom of the scale, under the lamp: a bar that floated would read as a
    // level twice, once by its top and once by its length.
    expect((bar?.top ?? 0) + (bar?.height ?? 0)).toBe((rail?.height ?? 0) - 5)
  })

  /** Amber says the same thing as the amber band of the wave: six decibels of room left, no more. */
  it('turns amber above the hot threshold, keeping the calm part underneath', () => {
    const inks = paint({ ...RESTING_METER, level: fromDb(-3), peak: fromDb(-3) }).map(
      band => band.ink,
    )

    expect(inks).toContain('green')
    expect(inks).toContain('amber')
  })

  it('leaves the amber out entirely while the sound stays under the threshold', () => {
    const inks = paint({ ...RESTING_METER, level: fromDb(HOT_DB - 6), peak: 0 }).map(
      band => band.ink,
    )

    expect(inks).not.toContain('amber')
  })

  /**
   * The lamp, not a band: full scale is the TOP of the scale, so a red segment of the bar would
   * be a segment of zero height. What one frame at full scale needs is a mark that stays.
   */
  it('lights the overload lamp only once full scale was touched', () => {
    const quiet = paint({ ...RESTING_METER, level: 0.5, peak: 0.5 })
    const overloaded = paint({ ...RESTING_METER, level: 1, peak: 1, clipped: true })

    expect(quiet.map(band => band.ink)).not.toContain('red')
    expect(overloaded.filter(band => band.ink === 'red')).toEqual([
      { ink: 'red', top: 0, height: 4 },
    ])
  })

  it('stands the witness above the bar, where the sound last peaked', () => {
    const drawn = paint({ ...RESTING_METER, level: fromDb(-24), peak: fromDb(-6) })
    const bar = drawn.find(band => band.ink === 'green')
    const witness = drawn.find(band => band.ink === 'witness')

    expect(witness).toBeDefined()
    expect(witness?.top).toBeLessThan(bar?.top ?? 0)
  })
})
