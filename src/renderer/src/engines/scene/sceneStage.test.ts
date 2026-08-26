import { describe, expect, it, vi } from 'vitest'
import { EMPTY_TIMELINE } from '@shared/domain/animation'
import { SECOND } from '@shared/domain/time'
import { cameraShot } from './animation-fixtures'
import { cameraNodeFixture } from './scene-fixtures'
import type { SceneRenderer } from './SceneRenderer'
import { createSceneStage, type SceneStage } from './sceneStage'
import { EMPTY_SCENE, type SceneState } from './sceneState'

/** The two reads a stage waits on, captured so a case can land one. */
const landings = { skies: () => {}, materials: (_ids: readonly string[]) => {} }

vi.mock('@/stores/skyboxSources', () => ({
  onSkiesRead: (listen: () => void) => {
    landings.skies = listen
    return () => {}
  },
}))

vi.mock('@/stores/materialSources', () => ({
  onMaterialsRead: (listen: (ids: readonly string[]) => void) => {
    landings.materials = listen
    return () => {}
  },
}))

/**
 * The calls a stage makes on a renderer, and nothing else — jsdom has no WebGL to build a real
 * one, which is what `createRenderer` exists for.
 */
function stubRenderer(): {
  renderer: SceneRenderer
  record: { drawn: (string | null)[]; framed: number; lit: number; dressed: number }
} {
  const record = { drawn: [] as (string | null)[], framed: 0, lit: 0, dressed: 0 }
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
    lightAgain: () => {
      record.lit += 1
    },
    dressModels: () => {
      record.dressed += 1
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

const stageOn = (): { stage: SceneStage; record: ReturnType<typeof stubRenderer>['record'] } => {
  const { renderer, record } = stubRenderer()
  return {
    stage: createSceneStage({ width: 16, height: 9, createRenderer: () => renderer }),
    record,
  }
}

describe('the stage a montage watches a scene through', () => {
  /**
   * The one line that gives the montage and the export the whole camera sequence: `draw` resolves
   * the camera per INSTANT, so a clip of this scene changes camera half way through, exactly as
   * the viewport does.
   */
  it('takes each instant through the camera the shots put on air then', () => {
    const { stage, record } = stageOn()

    stage.show(sequenced)
    stage.draw(3 * SECOND)
    stage.draw(10 * SECOND)

    expect(record.drawn).toEqual(['cam-a', 'cam-b'])
    stage.dispose()
  })

  // Framing the contents is what a scene with no camera of its own gets. A sequenced scene asking
  // for it would have the montage fight the shots for where the picture is taken from.
  it('frames the contents itself only while no camera is on air', () => {
    const sequence = stageOn()
    sequence.stage.show(sequenced)
    sequence.stage.draw(3 * SECOND)

    const bare = stageOn()
    bare.stage.show({ ...EMPTY_SCENE, nodes: [] })
    bare.stage.draw(3 * SECOND)

    expect([sequence.record.framed, bare.record.framed]).toEqual([0, 1])
    sequence.stage.dispose()
    bare.stage.dispose()
  })

  /**
   * The documents a scene NAMES land a beat after the first frame, and nothing here waited for
   * them: a clip drew at the procedural studio while the same scene, open in the 3D tab, drew lit
   * by its sky — two surfaces disagreeing about one document for the rest of the session.
   */
  it('lights and dresses again once a document it names has been read', () => {
    const { renderer, record } = stubRenderer()
    const stage = createSceneStage({ width: 8, height: 8, createRenderer: () => renderer })
    stage.show(EMPTY_SCENE)

    landings.skies()
    landings.materials(['mat-1'])

    expect(record.lit).toBe(1)
    expect(record.dressed).toBe(1)
    stage.dispose()
  })
})
