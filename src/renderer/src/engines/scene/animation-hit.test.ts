import { describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { RULER_HEIGHT, type Viewport } from '../timeline/timeline-geometry'
import { animationTrack, timelineWith } from './animation-fixtures'
import { hitAnimation, type HitContext } from './animation-hit'
import { CHANNEL_HEIGHT, SUBJECT_HEIGHT, animationRows } from './animation-rows'

/** One pixel per 10 ms, so a second is a hundred pixels across. */
const viewport: Viewport = { scale: 100 / SECOND, offset: 0, scrollTop: 0 }

const key = (seconds: number) => ({ time: seconds * SECOND, value: { x: 0, y: 0, z: 0 } })

function contextWith(expanded: string[] = []): HitContext {
  const rows = animationRows(
    timelineWith([
      animationTrack('a', 'position', [key(0), key(2)]),
      animationTrack('b', 'rotation', [key(1)]),
    ]),
    { nameOf: () => 'Circle', expanded: new Set(expanded) },
  )
  return { rows, viewport, fps: 25 }
}

/** The vertical middle of the first row, which is the subject line. */
const SUBJECT_MIDDLE = RULER_HEIGHT + SUBJECT_HEIGHT / 2

describe('pointing at the animation band', () => {
  it('reads the graduated strip as a scrub, at the time under the pointer', () => {
    expect(hitAnimation(contextWith(), { x: 300, y: 4 })).toEqual({
      kind: 'ruler',
      time: 3 * SECOND,
    })
  })

  it('snaps the time it answers to the frame grid', () => {
    // 313 px is 3.13 s; at 25 fps the nearest frame is 3.12 s.
    const hit = hitAnimation(contextWith(), { x: 313, y: 4 })
    expect(hit?.kind === 'ruler' && hit.time).toBe(3_120_000)
  })

  it('finds a key when the pointer is on it', () => {
    expect(hitAnimation(contextWith(), { x: 200, y: SUBJECT_MIDDLE })).toEqual({
      kind: 'key',
      rowId: 'cube',
      time: 2 * SECOND,
    })
  })

  it('forgives a couple of pixels, since a diamond is only a few across', () => {
    const hit = hitAnimation(contextWith(), { x: 204, y: SUBJECT_MIDDLE })
    expect(hit?.kind).toBe('key')
  })

  it('reads the row itself once the pointer is clear of every key', () => {
    expect(hitAnimation(contextWith(), { x: 400, y: SUBJECT_MIDDLE })).toEqual({
      kind: 'row',
      rowId: 'cube',
      time: 4 * SECOND,
    })
  })

  it('shows a folded subject the keys of all its channels', () => {
    // The rotation key at one second belongs to channel `b`, and the folded line carries it.
    const hit = hitAnimation(contextWith(), { x: 100, y: SUBJECT_MIDDLE })
    expect(hit).toEqual({ kind: 'key', rowId: 'cube', time: 1 * SECOND })
  })

  it('reaches a channel row once the subject is unfolded', () => {
    const context = contextWith(['cube'])
    const y = RULER_HEIGHT + SUBJECT_HEIGHT + CHANNEL_HEIGHT / 2

    expect(hitAnimation(context, { x: 200, y })).toEqual({
      kind: 'key',
      rowId: 'a',
      time: 2 * SECOND,
    })
  })

  it('does not offer a rotation key on the position channel', () => {
    const context = contextWith(['cube'])
    const y = RULER_HEIGHT + SUBJECT_HEIGHT + CHANNEL_HEIGHT / 2

    // One second is `b`'s key, not `a`'s: on `a`'s row it is empty space.
    expect(hitAnimation(context, { x: 100, y })?.kind).toBe('row')
  })

  it('answers nothing below the last row rather than clamping to it', () => {
    expect(hitAnimation(contextWith(), { x: 200, y: 4_000 })).toBeNull()
  })

  it('follows the scroll, so a scrolled row is still hit where it is drawn', () => {
    const context = contextWith()
    const scrolled = { ...context, viewport: { ...viewport, scrollTop: SUBJECT_HEIGHT } }

    // The subject has scrolled up out of view, so its middle no longer answers.
    expect(hitAnimation(scrolled, { x: 200, y: SUBJECT_MIDDLE })).toBeNull()
  })

  it('follows the horizontal offset, so a panned key is hit where it is drawn', () => {
    const context = contextWith()
    const panned = { ...context, viewport: { ...viewport, offset: 1 * SECOND } }

    // Panned one second right, the key at two seconds now sits a hundred pixels in.
    expect(hitAnimation(panned, { x: 100, y: SUBJECT_MIDDLE })).toEqual({
      kind: 'key',
      rowId: 'cube',
      time: 2 * SECOND,
    })
  })
})
