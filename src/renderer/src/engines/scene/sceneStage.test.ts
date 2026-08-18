import { describe, expect, it } from 'vitest'
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { cameraShot } from './animation-fixtures'
import { cameraNodeFixture } from './scene-fixtures'
import type { SceneRenderer } from './SceneRenderer'
import { createSceneStage } from './sceneStage'
import { EMPTY_SCENE, type SceneState } from './sceneState'

/**
 * The calls a stage makes on a renderer, and nothing else — jsdom has no WebGL to build a real
 * one, which is what `createRenderer` exists for.
 */
function stubRenderer(): {
  renderer: SceneRenderer
  /** Handed back whole rather than spread: a count spread out is a count frozen at zero. */
  record: { drawn: (string | null)[]; framed: number }
} {
  const record = { drawn: [] as (string | null)[], framed: 0 }
  const stub = {
    prepareOffscreen: () => {},
    mount: () => {},
    configure: () => {},
    apply: () => {},
    setPlayhead: () => {},
    frameContents: () => {
      record.framed += 1
      return true
    },
    drawFrom: (cameraId: string | null) => {
      record.drawn.push(cameraId)
      return null
    },
    dispose: () => {},
  }

  // A stub of the calls a stage makes, which no partial of a class can be spelled as.
  return { renderer: stub as unknown as SceneRenderer, record }
}

/** Camera A on air from zero, camera B from seven seconds — the sequence of the issue. */
const sequenced: SceneState = {
  ...EMPTY_SCENE,
  nodes: [cameraNodeFixture('cam-a'), cameraNodeFixture('cam-b')],
  animation: {
    ...EMPTY_TIMELINE,
    shots: [
      cameraShot('s1', { cameraId: 'cam-a', start: 0, duration: 7 * SECOND }),
      cameraShot('s2', { cameraId: 'cam-b', start: 7 * SECOND, duration: 8 * SECOND }),
    ],
  },
}

describe('the stage a montage watches a scene through', () => {
  /**
   * The one line that gives the montage and the export the whole camera sequence: `draw` resolves
   * the camera per INSTANT, so a clip of this scene changes camera half way through, exactly as
   * the viewport does.
   */
  it('takes each instant through the camera the shots put on air then', () => {
    const { renderer, record } = stubRenderer()
    const stage = createSceneStage({ width: 16, height: 9, createRenderer: () => renderer })

    stage.show(sequenced)
    stage.draw(3 * SECOND)
    stage.draw(10 * SECOND)

    expect(record.drawn).toEqual(['cam-a', 'cam-b'])
    stage.dispose()
  })

  // Framing the contents is what a scene with no camera of its own gets. A sequenced scene asking
  // for it would have the montage fight the shots for where the picture is taken from.
  it('frames the contents itself only while no camera is on air', () => {
    const withShots = stubRenderer()
    const stage = createSceneStage({
      width: 16,
      height: 9,
      createRenderer: () => withShots.renderer,
    })
    stage.show(sequenced)
    stage.draw(3 * SECOND)

    const bare = stubRenderer()
    const plain = createSceneStage({ width: 16, height: 9, createRenderer: () => bare.renderer })
    plain.show({ ...EMPTY_SCENE, nodes: [] })
    plain.draw(3 * SECOND)

    expect([withShots.record.framed, bare.record.framed]).toEqual([0, 1])
    stage.dispose()
    plain.dispose()
  })
})
