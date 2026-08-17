import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline, type CameraShot } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { activeCameraAt, activeShotAt } from './cameraShots'
import { cameraNodeFixture, meshNode } from './scene-fixtures'

const shot = (
  id: string,
  cameraId: string,
  start: number,
  duration: number,
  layer = 0,
): CameraShot => ({
  id,
  cameraId,
  layer,
  start: start * SECOND,
  duration: duration * SECOND,
})

const timelineOf = (...shots: CameraShot[]): AnimationTimeline => ({ ...EMPTY_TIMELINE, shots })

const CAMERAS = [cameraNodeFixture('cam-a'), cameraNodeFixture('cam-b')]

describe('activeCameraAt', () => {
  it('gives each shot its own stretch of time, and never two cameras at once', () => {
    const timeline = timelineOf(shot('s1', 'cam-a', 0, 7), shot('s2', 'cam-b', 7, 8, 1))

    expect(activeCameraAt(timeline, CAMERAS, 0)).toBe('cam-a')
    expect(activeCameraAt(timeline, CAMERAS, 6.9 * SECOND)).toBe('cam-a')
    expect(activeCameraAt(timeline, CAMERAS, 7 * SECOND)).toBe('cam-b')
    expect(activeCameraAt(timeline, CAMERAS, 14.9 * SECOND)).toBe('cam-b')
  })

  it('gives the higher layer the instant both shots cover', () => {
    const timeline = timelineOf(shot('under', 'cam-a', 0, 10), shot('over', 'cam-b', 5, 10, 2))

    expect(activeShotAt(timeline, CAMERAS, 6 * SECOND)?.id).toBe('over')
  })

  it('gives the later shot the instant, when both sit on the same layer', () => {
    const timeline = timelineOf(shot('first', 'cam-a', 0, 10), shot('second', 'cam-b', 5, 10))

    expect(activeShotAt(timeline, CAMERAS, 6 * SECOND)?.id).toBe('second')
  })

  // What every document written before shots existed reads as, and what a gap between two shots
  // must keep doing: the film and the montage looked through the first camera, and still do.
  it('falls back to the first camera of the document where no shot covers the instant', () => {
    const timeline = timelineOf(shot('s1', 'cam-b', 10, 5))

    expect(activeCameraAt(timeline, CAMERAS, 0)).toBe('cam-a')
    expect(activeCameraAt(EMPTY_TIMELINE, CAMERAS, 0)).toBe('cam-a')
  })

  it('answers nothing for a scene that holds no camera', () => {
    expect(activeCameraAt(EMPTY_TIMELINE, [meshNode('box')], 0)).toBeNull()
  })

  // A deleted camera leaves its shots behind: answering with a dead id would black out the film.
  it('skips a shot whose camera the scene no longer holds', () => {
    const timeline = timelineOf(shot('gone', 'cam-gone', 0, 10, 5), shot('kept', 'cam-a', 0, 10))

    expect(activeCameraAt(timeline, CAMERAS, 1 * SECOND)).toBe('cam-a')
  })
})
