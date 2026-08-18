import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline, type CameraShot } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import {
  activeCameraAt,
  activeShotAt,
  draggedShot,
  newShotAt,
  shotCameras,
  shotsWith,
  shotsWithCameraMoved,
} from './cameraShots'
import { cameraShot } from './animation-fixtures'
import { cameraNodeFixture, meshNode } from './scene-fixtures'

const timelineOf = (...shots: CameraShot[]): AnimationTimeline => ({ ...EMPTY_TIMELINE, shots })

const CAMERAS = [cameraNodeFixture('cam-a'), cameraNodeFixture('cam-b')]

describe('activeCameraAt', () => {
  it('gives each shot its own stretch of time, and never two cameras at once', () => {
    const timeline = timelineOf(
      cameraShot('s1', { cameraId: 'cam-a', duration: 7 * SECOND }),
      cameraShot('s2', { cameraId: 'cam-b', start: 7 * SECOND, duration: 8 * SECOND }),
    )

    expect(activeCameraAt(timeline, CAMERAS, 0)).toBe('cam-a')
    expect(activeCameraAt(timeline, CAMERAS, 6.9 * SECOND)).toBe('cam-a')
    expect(activeCameraAt(timeline, CAMERAS, 7 * SECOND)).toBe('cam-b')
    expect(activeCameraAt(timeline, CAMERAS, 14.9 * SECOND)).toBe('cam-b')
  })

  // The law the band draws: the camera whose line stands highest wins the instant, and its line
  // stands where its first shot does in the list.
  it('gives the instant both shots cover to the camera whose line is highest', () => {
    const shots = [
      cameraShot('over', { cameraId: 'cam-b', duration: 10 * SECOND }),
      cameraShot('under', { cameraId: 'cam-a', start: 5 * SECOND, duration: 10 * SECOND }),
    ]

    expect(activeShotAt(timelineOf(...shots), CAMERAS, 6 * SECOND)?.id).toBe('over')
    // The same two shots, the lines the other way up: what changed is the order, and only that.
    expect(activeShotAt(timelineOf(...shots.reverse()), CAMERAS, 6 * SECOND)?.id).toBe('under')
  })

  it('gives the later shot the instant, when both belong to one camera', () => {
    const timeline = timelineOf(
      cameraShot('first', { cameraId: 'cam-a', duration: 10 * SECOND }),
      cameraShot('second', { cameraId: 'cam-a', start: 5 * SECOND, duration: 10 * SECOND }),
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
      cameraShot('gone', { cameraId: 'cam-gone', duration: 10 * SECOND }),
      cameraShot('kept', { cameraId: 'cam-a', duration: 10 * SECOND }),
    )

    expect(activeCameraAt(timeline, CAMERAS, 1 * SECOND)).toBe('cam-a')
  })
})

describe('newShotAt', () => {
  it('opens at the head, for the camera it names', () => {
    const shot = newShotAt(EMPTY_TIMELINE, 'cam-a', 'fresh', 1 * SECOND)

    expect(shot).toMatchObject({ id: 'fresh', cameraId: 'cam-a', start: 1 * SECOND })
  })

  it('never opens one of no length, however late the head stands', () => {
    const late = newShotAt(EMPTY_TIMELINE, 'cam-a', 'fresh', EMPTY_TIMELINE.duration + 9 * SECOND)

    expect(late.duration).toBeGreaterThan(0)
    expect(late.start).toBeLessThanOrEqual(EMPTY_TIMELINE.duration)
  })
})

describe('shotsWith', () => {
  const held = [
    cameraShot('a1', { cameraId: 'cam-a' }),
    cameraShot('b1', { cameraId: 'cam-b' }),
    cameraShot('a2', { cameraId: 'cam-a' }),
  ]

  // A shot laid down only to be hidden by what was already there reads as a button doing nothing.
  it('puts a camera the band does not show yet on top of the stack', () => {
    const shots = shotsWith(held, cameraShot('c1', { cameraId: 'cam-c' }))

    expect(shotCameras(shots)).toEqual(['cam-c', 'cam-a', 'cam-b'])
  })

  // The line must not jump: a camera already on the band keeps the rank it was dragged to.
  it('joins the end of its own run for a camera already on the band', () => {
    const shots = shotsWith(held, cameraShot('a3', { cameraId: 'cam-a' }))

    expect(shots.map(shot => shot.id)).toEqual(['a1', 'b1', 'a2', 'a3'])
    expect(shotCameras(shots)).toEqual(['cam-a', 'cam-b'])
  })
})

describe('shotsWithCameraMoved', () => {
  const held = [
    cameraShot('a1', { cameraId: 'cam-a' }),
    cameraShot('b1', { cameraId: 'cam-b' }),
    cameraShot('a2', { cameraId: 'cam-a' }),
    cameraShot('c1', { cameraId: 'cam-c' }),
  ]

  // The whole run travels, because a line IS a camera: moving one bar out of the run it shares
  // with the others would leave the stack exactly as it was.
  it('moves a camera line down the stack, its shots travelling whole', () => {
    const moved = shotsWithCameraMoved(held, 'cam-a', 1)

    expect(moved?.steps).toBe(1)
    expect(moved?.shots.map(shot => shot.id)).toEqual(['b1', 'a1', 'a2', 'c1'])
  })

  it('takes the notches it can when asked for more, so the grip banks no step it never made', () => {
    expect(shotsWithCameraMoved(held, 'cam-a', 9)?.steps).toBe(2)
  })

  it('answers nothing at the end of the stack, and for a camera no line shows', () => {
    expect(shotsWithCameraMoved(held, 'cam-c', 1)).toBeNull()
    expect(shotsWithCameraMoved(held, 'cam-gone', -1)).toBeNull()
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
