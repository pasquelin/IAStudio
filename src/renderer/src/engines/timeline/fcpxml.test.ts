import { describe, expect, it } from 'vitest'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import { SECOND } from './timelineState'
import { fcpxmlOf } from './fcpxml'

const named = (assetId: string): string => ({ 'asset-a': 'Plan large' })[assetId] ?? assetId

const written = (state: Parameters<typeof fcpxmlOf>[0]): string => fcpxmlOf(state, 'Bande', named)

const ONE_CLIP = sequenceWith([
  trackFixture('V1', 'video', [clipFixture('a', SECOND, 2 * SECOND, { inPoint: 5 * SECOND })]),
])

describe('a cut as FCPXML', () => {
  it('opens on the declaration and the version a reader looks for', () => {
    expect(written(ONE_CLIP)).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(written(ONE_CLIP)).toContain('<fcpxml version="1.9">')
  })

  /** A reader refuses a file without the three, none of which the studio has a notion of. */
  it('nests the project in an event in a library, each named after the document', () => {
    const file = written(ONE_CLIP)

    expect(file).toContain('<library name="Bande">')
    expect(file).toContain('<event name="Bande">')
    expect(file).toContain('<project name="Bande">')
  })

  /**
   * The times are RATIONALS over the frame rate, and never decimals: `50/25s` is frame fifty, and
   * a decimal is the classic way to make a cut land a frame off.
   */
  it('writes every time as frames over the rate', () => {
    const file = written(ONE_CLIP)

    expect(file).toContain('offset="25/25s"')
    expect(file).toContain('start="125/25s"')
    expect(file).toContain('duration="50/25s"')
    expect(file).toMatch(/frameDuration="1\/25s"/)
  })

  /** A rush cut into two is one file, and declaring it twice is a resource table that lies. */
  it('declares one asset per rush however many clips point at it', () => {
    const twice = sequenceWith([
      trackFixture('V1', 'video', [
        clipFixture('a', 0, SECOND, { assetId: 'asset-a' }),
        clipFixture('b', SECOND, SECOND, { assetId: 'asset-a' }),
      ]),
    ])

    expect(written(twice).match(/<asset id=/g)).toHaveLength(1)
    expect(written(twice).match(/<asset-clip /g)).toHaveLength(2)
  })

  /** Lane 0 is the spine every reader draws first; the rows beside it count up from there. */
  it('gives each track a lane of its own', () => {
    const two = sequenceWith([
      trackFixture('V1', 'video', [clipFixture('a', 0, SECOND)]),
      trackFixture('A1', 'audio', [clipFixture('b', 0, SECOND)]),
    ])

    expect(written(two)).toContain('lane="0"')
    expect(written(two)).toContain('lane="1"')
  })

  it('says a muted track is not enabled, which is the one switch the format holds', () => {
    const muted = sequenceWith([
      trackFixture('V1', 'video', [clipFixture('a', 0, SECOND)], { muted: true }),
    ])

    expect(written(muted)).toContain('enabled="0"')
  })

  /** A name is written into an attribute, and an ampersand there makes a file nothing parses. */
  it('escapes what XML cannot hold raw', () => {
    const file = fcpxmlOf(ONE_CLIP, 'Rushes & <essais>', named)

    expect(file).toContain('name="Rushes &amp; &lt;essais&gt;"')
    expect(file).not.toContain('name="Rushes & <')
  })

  /** The format names a FILE, and a clip drawing a live scene has none to name. */
  it('leaves out a clip that draws a scene rather than a rush', () => {
    const scene = sequenceWith([
      trackFixture('V1', 'video', [
        clipFixture('a', 0, SECOND, { assetId: '', sceneId: 'scene-1' }),
      ]),
    ])

    expect(written(scene)).not.toContain('<asset-clip')
  })
})
