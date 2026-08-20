import { describe, expect, it } from 'vitest'
import { clipFixture, sequenceWith, trackFixture } from './timeline-fixtures'
import { SECOND } from './timelineState'
import { edlOf } from './edl'

const named = (assetId: string): string => ({ 'asset-a': 'Plan large' })[assetId] ?? assetId

const written = (state: Parameters<typeof edlOf>[0]): string[] =>
  edlOf(state, 'Bande', named).split('\n')

const ONE_CLIP = sequenceWith([
  trackFixture('V1', 'video', [clipFixture('a', SECOND, 2 * SECOND, { inPoint: 5 * SECOND })]),
])

describe('an edit decision list', () => {
  it('opens on the two lines every reader looks for', () => {
    const [title, mode] = written(ONE_CLIP)

    expect(title).toBe('TITLE: BANDE')
    expect(mode).toBe('FCM: NON-DROP FRAME')
  })

  /**
   * The four timecodes are the whole of the format: where the shot starts and ends in its source,
   * and where it starts and ends in the programme. Getting the pair the wrong way round is the
   * defect an online room finds and no other assertion would.
   */
  it('writes the source range and the record range, in that order', () => {
    const [, , event] = written(ONE_CLIP)

    expect(event).toContain('00:00:05:00 00:00:07:00 00:00:01:00 00:00:03:00')
  })

  it('numbers the events from one, three digits wide', () => {
    const state = sequenceWith([
      trackFixture('V1', 'video', [clipFixture('a', 0, SECOND), clipFixture('b', SECOND, SECOND)]),
    ])

    const events = written(state).filter(line => /^\d{3} /.test(line))
    expect(events.map(line => line.slice(0, 3))).toEqual(['001', '002'])
  })

  it('names the clip on the line the format reserves for it', () => {
    expect(written(ONE_CLIP)).toContain('* FROM CLIP NAME: Plan large')
  })

  /** Eight characters, letters and digits — an EDL is a fixed-column file and a reel is a field. */
  it('takes a name down to a reel the columns can hold', () => {
    const [, , event] = written(ONE_CLIP)

    expect(event?.slice(4, 12)).toBe('PLANLARG')
  })

  it('writes the channel each track takes, and the two the notation has', () => {
    const state = sequenceWith([
      trackFixture('A2', 'audio', [clipFixture('c', 0, SECOND)]),
      trackFixture('A1', 'audio', [clipFixture('b', 0, SECOND)]),
      trackFixture('V1', 'video', [clipFixture('a', 0, SECOND)]),
    ])

    const channels = written(state)
      .filter(line => /^\d{3} /.test(line))
      .map(line => line.slice(13, 16).trim())

    expect(channels).toEqual(['V', 'A', 'A2'])
  })

  /**
   * A straight cut for every event. A fade held by a clip is not a transition BETWEEN two shots,
   * which is the only thing `D` spells — writing one would change the cut the file describes.
   */
  it('writes a cut even where the clip carries a fade', () => {
    const faded = sequenceWith([
      trackFixture('V1', 'video', [clipFixture('a', 0, SECOND, { fadeIn: SECOND / 2 })]),
    ])

    expect(written(faded)[2]?.slice(17, 18)).toBe('C')
  })

  /**
   * A clip drawing a live scene names no rush. Written all the same, it came out as an event on
   * reel `AX` with an empty `FROM CLIP NAME` — a shot an online room cannot conform to anything.
   */
  it('leaves out a clip that draws a scene rather than a rush', () => {
    const scene = sequenceWith([
      trackFixture('V1', 'video', [
        clipFixture('a', 0, SECOND, { assetId: '', sceneId: 'doc-scene' }),
      ]),
    ])

    expect(written(scene).filter(line => /^\d{3} /.test(line))).toEqual([])
  })

  it('writes a header and nothing else for a montage with no clip at all', () => {
    expect(written(sequenceWith([trackFixture('V1', 'video', [])]))).toEqual([
      'TITLE: BANDE',
      'FCM: NON-DROP FRAME',
      '',
    ])
  })
})
