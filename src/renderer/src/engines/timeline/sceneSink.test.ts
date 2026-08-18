import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { SceneStage } from '../scene/sceneStage'
import { createModelScene, createSceneSink } from './sceneSink'

// jsdom implements no WebCodecs at all. The sink only ever hands one back, so a marker object
// is enough to say which canvas it wrapped and when.
beforeAll(() => {
  vi.stubGlobal(
    'VideoFrame',
    class {
      constructor(
        readonly source: unknown,
        readonly init: { timestamp: number },
      ) {}
    },
  )
})

function stubStage(
  canvas: HTMLCanvasElement | null = document.createElement('canvas'),
): SceneStage {
  return { show: vi.fn(), draw: vi.fn(() => canvas), dispose: vi.fn() }
}

describe('createModelScene', () => {
  it('lights the model it wraps, so a dropped file is not a black silhouette', () => {
    const scene = createModelScene('asset_1', 'Robot')

    expect(scene.read().nodes.some(node => node.type === 'model')).toBe(true)
    expect(scene.read().nodes.some(node => node.type === 'light')).toBe(true)
  })

  it('holds no camera, leaving the stage to frame whatever the file turned out to be', () => {
    expect(
      createModelScene('asset_1', 'Robot')
        .read()
        .nodes.some(n => n.type === 'camera'),
    ).toBe(false)
  })

  it('plays the first clip once the file says it has one', () => {
    const scene = createModelScene('asset_1', 'Robot')
    const model = scene.read().nodes.find(node => node.type === 'model')

    scene.useClips(model?.id ?? '', ['Walk', 'Idle'])

    const played = scene.read().nodes.find(node => node.type === 'model')
    expect(played?.type === 'model' ? played.model.lanes?.[0]?.clips[0]?.source.name : null).toBe(
      'Walk',
    )
  })

  it('hands back a new state object, so a stage comparing references sees the change', () => {
    const scene = createModelScene('asset_1', 'Robot')
    const before = scene.read()
    const model = before.nodes.find(node => node.type === 'model')

    scene.useClips(model?.id ?? '', ['Walk'])

    expect(scene.read()).not.toBe(before)
  })

  it('ignores clips announced for another node', () => {
    const scene = createModelScene('asset_1', 'Robot')
    const before = scene.read()

    scene.useClips('someone-else', ['Walk'])

    expect(scene.read()).toBe(before)
  })
})

describe('createSceneSink', () => {
  it('draws the instant asked for and hands the picture back as a frame', async () => {
    const stage = stubStage()
    const sink = createSceneSink({ read: () => createModelScene('a', 'A').read(), stage })

    const sample = await sink.getSample(2)

    expect(stage.draw).toHaveBeenCalledWith(2_000_000)
    expect(sample).not.toBeNull()
  })

  it('re-reads the scene on every frame, which is what makes an edit show up at once', async () => {
    const read = vi.fn(() => createModelScene('a', 'A').read())
    const sink = createSceneSink({ read, stage: stubStage() })

    await sink.getSample(0)
    await sink.getSample(1)

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('draws nothing while the scene has not arrived, rather than an empty one', async () => {
    const stage = stubStage()

    expect(await createSceneSink({ read: () => null, stage }).getSample(0)).toBeNull()
    expect(stage.draw).not.toHaveBeenCalled()
  })

  it('holds no hardware decoder: a scene costs a WebGL context, not a decoder slot', () => {
    expect(createSceneSink({ read: () => null, stage: stubStage() }).holdsDecoder).toBe(false)
  })

  it('closes the stage with itself, so the context goes back when the pool evicts it', () => {
    const stage = stubStage()

    createSceneSink({ read: () => null, stage }).close()

    expect(stage.dispose).toHaveBeenCalled()
  })
})
