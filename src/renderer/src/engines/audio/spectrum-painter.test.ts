import { describe, expect, it } from 'vitest'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { fromDb } from './audio-data'
import { HOT_DB } from './level'
import { paintSpectrum, type SpectrumInk, type SpectrumMarks } from './spectrum-painter'
import type { SpectrumBand } from './spectrum'

const ink: SpectrumInk = {
  background: 'bg',
  safe: 'green',
  hot: 'amber',
  clip: 'red',
  line: 'grid',
  text: 'label',
  font: '9px monospace',
}

const marks: SpectrumMarks = { hertz: 'Hz', kilohertz: 'kHz', language: 'en' }

const surface = () => {
  const written: string[] = []
  const filled: string[] = []
  let current = ''
  const context = {
    fillRect: () => filled.push(current),
    fillText: (text: string) => written.push(text),
    set fillStyle(colour: string) {
      current = colour
    },
    set font(_font: string) {},
    set textBaseline(_baseline: string) {},
  } as unknown as CanvasRenderingContext2D

  return { written, filled, context }
}

const paint = (bands: SpectrumBand[]) => {
  const drawn = surface()
  paintSpectrum(drawn.context, { width: 320, height: 72 }, bands, ink, marks)
  return drawn
}

describe('the spectrum band', () => {
  /**
   * Hertz below a thousand and kilohertz above, as every analyser is graduated: `10 000 Hz` is a
   * number one counts the digits of.
   */
  it('graduates by decade, switching to kilohertz where an analyser does', () => {
    const { written } = paint([])

    expect(written).toEqual([
      `100${NO_BREAK_SPACE}Hz`,
      `1${NO_BREAK_SPACE}kHz`,
      `10${NO_BREAK_SPACE}kHz`,
    ])
  })

  it('still graduates itself when nothing is playing', () => {
    expect(paint([]).filled).toContain('grid')
  })

  /** The wave's own three bands, so an amber bar means here what an amber crest means there. */
  it('colours a bar by the level it stands at', () => {
    const { filled } = paint([
      { from: 100, level: 0.2 },
      { from: 1_000, level: fromDb(HOT_DB / 2) },
      { from: 10_000, level: 1 },
    ])

    expect(filled).toContain('green')
    expect(filled).toContain('amber')
    expect(filled).toContain('red')
  })

  it('draws no bar at all for a register holding nothing', () => {
    const quiet = paint([{ from: 100, level: 0 }])

    expect(quiet.filled).not.toContain('green')
  })
})
