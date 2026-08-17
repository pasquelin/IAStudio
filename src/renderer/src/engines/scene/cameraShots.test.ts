import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline, type CameraShot } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { activeCameraAt, activeShotAt, draggedShot } from './cameraShots'
import { cameraShot } from './animation-fixtures'
import { cameraNodeFixture, meshNode } from './scene-fixtures'

const timelineOf = (...shots: CameraShot[]): AnimationTimeline => ({ ...EMPTY_TIMELINE, shots })

const CAMERAS = [cameraNodeFixture('cam-a'), cameraNodeFixture('cam-b')]

describe('activeCameraAt', () => {
  it('gives each shot its own stretch of time, and never two cameras at once', () => {
    const timeline = timelineOf(
      cameraShot('s1', { cameraId: 'cam-a', duration: 7 * SECOND }),
      cameraShot('s2', { cameraId: 'cam-b', start: 7 * SECOND, duration: 8 * SECOND, layer: 1 }),
    )

    expect(activeCameraAt(timeline, CAMERAS, 0)).toBe('cam-a')
    expect(activeCameraAt(timeline, CAMERAS, 6.9 * SECOND)).toBe('cam-a')
    expect(activeCameraAt(timeline, CAMERAS, 7 * SECOND)).toBe('cam-b')
    expect(activeCameraAt(timeline, CAMERAS, 14.9 * SECOND)).toBe('cam-b')
  })

  it('gives the higher layer the instant both shots cover', () => {
    const timeline = timelineOf(
      cameraShot('under', { cameraId: 'cam-a', duration: 10 * SECOND }),
      cameraShot('over', {
        cameraId: 'cam-b',
        start: 5 * SECOND,
        duration: 10 * SECOND,
        layer: 2,
      }),
    )

    expect(activeShotAt(timeline, CAMERAS, 6 * SECOND)?.id).toBe('over')
  })

  it('gives the later shot the instant, when both sit on the same layer', () => {
    const timeline = timelineOf(
      cameraShot('first', { cameraId: 'cam-a', duration: 10 * SECOND }),
      cameraShot('second', { cameraId: 'cam-b', start: 5 * SECOND, duration: 10 * SECOND }),
    )

    expect(activeShotAt(timeline, CAMERAS, 6 * SECOND)?.id).toBe('second')
  })

  // What every document written before shots existed reads as, and what a gap between two shots
  // must keep doing: the film and the montage looked through the first camera, and still do.
  it('falls back to the first camera of the document where no shot covers the instant', () => {
    const timeline = timelineOf(cameraShot('s1', { cameraId: 'cam-b', start: 10 * SECOND }))

    expect(activeCameraAt(timeline, CAMERAS, 0)).toBe('cam-a')
    expect(activeCameraAt(EMPTY_TIMELINE, CAMERAS, 0)).toBe('cam-a')
  })

  it('answers nothing for a scene that holds no camera', () => {
    expect(activeCameraAt(EMPTY_TIMELINE, [meshNode('box')], 0)).toBeNull()
  })

  // A deleted camera leaves its shots behind: answering with a dead id would black out the film.
  it('skips a shot whose camera the scene no longer holds', () => {
    const timeline = timelineOf(
      cameraShot('gone', { cameraId: 'cam-gone', duration: 10 * SECOND, layer: 5 }),
      cameraShot('kept', { cameraId: 'cam-a', duration: 10 * SECOND }),
    )

    expect(activeCameraAt(timeline, CAMERAS, 1 * SECOND)).toBe('cam-a')
  })
})

describe('draggedShot', () => {
  const shot = cameraShot('s1', { start: 2 * SECOND, duration: 4 * SECOND })
  const frame = SECOND / 25

  it('slides the whole shot, keeping where inside it the hand took hold', () => {
    expect(draggedShot(shot, { edge: null, grabbedAt: 1 * SECOND }, 5 * SECOND, frame)).toEqual({
      start: 4 * SECOND,
      duration: 4 * SECOND,
    })
  })

  it('never lets a shot start before the band does', () => {
    expect(draggedShot(shot, { edge: null, grabbedAt: 3 * SECOND }, 1 * SECOND, frame)).toEqual({
      start: 0,
      duration: 4 * SECOND,
    })
  })

  // Trimming the head moves the start and keeps the END where it stands — a trim that slid the
  // whole shot would be a move, which is the other gesture.
  it('trims the head against a fixed end', () => {
    expect(draggedShot(shot, { edge: 'start', grabbedAt: 0 }, 3 * SECOND, frame)).toEqual({
      start: 3 * SECOND,
      duration: 3 * SECOND,
    })
  })

  it('trims the tail', () => {
    expect(draggedShot(shot, { edge: 'end', grabbedAt: 0 }, 9 * SECOND, frame)).toEqual({
      start: 2 * SECOND,
      duration: 7 * SECOND,
    })
  })

  it('keeps a frame of length however far a trim is dragged past the other edge', () => {
    expect(draggedShot(shot, { edge: 'end', grabbedAt: 0 }, 0, frame)).toEqual({
      start: 2 * SECOND,
      duration: frame,
    })
    expect(draggedShot(shot, { edge: 'start', grabbedAt: 0 }, 30 * SECOND, frame)).toEqual({
      start: 6 * SECOND - frame,
      duration: frame,
    })
  })

  // A drag that has not left the frame it started on must cost no entry in the history.
  it('answers nothing when the shot would not move', () => {
    expect(draggedShot(shot, { edge: null, grabbedAt: 1 * SECOND }, 3 * SECOND, frame)).toBeNull()
  })
})
