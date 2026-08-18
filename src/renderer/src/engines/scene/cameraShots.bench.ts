import { bench, describe } from 'vitest'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { cameraShot } from './animation-fixtures'
import { cameraNodeFixture, meshNode } from './scene-fixtures'
import { activeCameraAt } from './cameraShots'
import type { SceneNode } from './sceneState'

/**
 * What resolving the camera costs, PER FRAME: a montage asks this of every frame it draws, and
 * the film asks it of every frame it writes. The scene sizes are the ones `sceneDocument.bench`
 * uses, since the answer used to be walked off the node list.
 */
function sceneOf(count: number): SceneNode[] {
  return [
    cameraNodeFixture('cam-a'),
    cameraNodeFixture('cam-b'),
    ...Array.from({ length: count }, (_unused, index) => meshNode(`node_${index}`)),
  ]
}

const timeline: AnimationTimeline = {
  ...EMPTY_TIMELINE,
  shots: [
    cameraShot('s1', { cameraId: 'cam-a', start: 0, duration: 7 * SECOND }),
    cameraShot('s2', { cameraId: 'cam-b', start: 7 * SECOND, duration: 8 * SECOND }),
  ],
}

describe('resolving which camera a frame is taken through', () => {
  for (const count of [50, 500, 5_000, 50_000]) {
    const nodes = sceneOf(count)
    bench(`${count} nodes`, () => {
      activeCameraAt(timeline, nodes, 10 * SECOND)
    })
  }
})
