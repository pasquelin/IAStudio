import { describe, expect, it, vi } from 'vitest'
import { emptyHistory, run, undo } from '../core/history'
import {
  RELIEF_CHUNK_TEXELS,
  applyReliefSculpt,
  changedChunks,
  type ReliefSculpt,
  type ReliefSculptOperation,
} from '@shared/domain/relief'
import {
  DEFAULT_RELIEF_ELEVATION,
  DEFAULT_RELIEF_ORIGIN,
  DEFAULT_RELIEF_SIZE,
  DEFAULT_WORLD,
  reliefLayer,
  terrainEditLayer,
} from '@shared/domain/scene'
import { sculptRelief } from './reliefCommands'
import { EMPTY_SCENE, type SceneState } from './sceneState'
import { createReliefSculptor } from './reliefSculptor'
import type { ReliefSculptRequest, ReliefSculptResponse } from './reliefSculptMessage'

const samples = { width: 66, height: 8, values: new Float32Array(66 * 8) }
const extent = {
  origin: DEFAULT_RELIEF_ORIGIN,
  size: DEFAULT_RELIEF_SIZE,
  elevation: DEFAULT_RELIEF_ELEVATION,
}
const stepX = extent.size.x / (samples.width - 1)

function diskAt(sampleX: number, amount: number) {
  return {
    samples,
    extent,
    grain: RELIEF_CHUNK_TEXELS,
    sculpt: undefined as ReliefSculpt | undefined,
    disk: {
      x: extent.origin.x + sampleX * stepX,
      z: extent.origin.z,
      radius: stepX,
    },
    amount,
  }
}

function fakeWorker() {
  const listeners: ((event: MessageEvent<ReliefSculptResponse>) => void)[] = []
  const posted: ReliefSculptRequest[] = []
  const worker = {
    postMessage: (message: unknown) => {
      posted.push(message as ReliefSculptRequest)
    },
    addEventListener: (
      type: string,
      listener: (event: MessageEvent<ReliefSculptResponse>) => void,
    ) => {
      if (type === 'message') listeners.push(listener)
    },
    terminate: vi.fn(),
  } as unknown as Worker

  return {
    worker,
    posted,
    reply: (data: ReliefSculptResponse) => {
      for (const listener of listeners) listener({ data } as MessageEvent<ReliefSculptResponse>)
    },
  }
}

function answer(fake: ReturnType<typeof fakeWorker>, request: ReliefSculptRequest): void {
  const after = applyReliefSculpt(
    { width: request.width, height: request.height, values: new Float32Array(0) },
    request.extent,
    request.sculpt,
    request.operation,
    request.grain,
    request.rows,
  )
  fake.reply({
    id: request.id,
    ok: true,
    grain: request.grain,
    chunks: changedChunks(request.sculpt, after),
  })
}

describe('createReliefSculptor', () => {
  it('splits a wide stroke by chunk rows and joins the edits in order', async () => {
    const fakes = [fakeWorker(), fakeWorker()]
    let next = 0
    const sculptor = createReliefSculptor(() => {
      const fake = fakes[next]
      next += 1
      if (!fake) throw new Error('No fake worker left')
      return fake.worker
    }, fakes.length)
    const side = 1024
    const wideSamples = { width: side, height: side, values: new Float32Array(side * side) }
    const stroke = {
      samples: wideSamples,
      extent,
      grain: RELIEF_CHUNK_TEXELS,
      sculpt: undefined,
      disk: {
        x: extent.origin.x + extent.size.x / 2,
        z: extent.origin.z + extent.size.z / 2,
        radius: Math.hypot(extent.size.x, extent.size.z) / 2,
      },
      amount: 2,
    }

    const pending = sculptor.raiseDisk(stroke)
    for (const fake of fakes) {
      const request = fake.posted[0]
      if (!request) throw new Error('parallel stroke was not sent')
      answer(fake, request)
    }

    const expected = applyReliefSculpt(wideSamples, extent, undefined, operationOf(stroke))
    expect(await pending).toEqual(changedChunks(undefined, expected))
    expect(fakes.map(fake => fake.posted[0]?.rows)).toEqual([
      { from: 0, to: 8 },
      { from: 8, to: 16 },
    ])
  })

  it('queues a second stroke so a drag does not drop the first disk', async () => {
    const fake = fakeWorker()
    const sculptor = createReliefSculptor(() => fake.worker)
    const first = diskAt(1, 2)
    const second = diskAt(2, 5)

    const pendingFirst = sculptor.raiseDisk(first)
    const pendingSecond = sculptor.raiseDisk(second)

    expect(fake.posted).toHaveLength(1)
    const request1 = fake.posted[0]
    if (!request1) throw new Error('first stroke was not sent')
    answer(fake, request1)
    const edits1 = await pendingFirst

    expect(fake.posted).toHaveLength(2)
    const request2 = fake.posted[1]
    if (!request2) throw new Error('second stroke was not sent')
    const afterFirst = applyReliefSculpt(samples, extent, undefined, operationOf(first))
    expect(request2.sculpt).toEqual(afterFirst)
    answer(fake, request2)
    const edits2 = await pendingSecond

    const afterSecond = applyReliefSculpt(samples, extent, afterFirst, operationOf(second))
    expect(edits1).toEqual(changedChunks(undefined, afterFirst))
    expect(edits2).toEqual(changedChunks(afterFirst, afterSecond))
    expect(edits2).not.toEqual(edits1)
  })

  it('drops an in-flight stroke when undo restores another sculpt', async () => {
    const fake = fakeWorker()
    const sculptor = createReliefSculptor(() => fake.worker)
    const first = diskAt(1, 2)
    const second = diskAt(2, 5)

    const pendingFirst = sculptor.raiseDisk(first)
    const request1 = fake.posted[0]
    if (!request1) throw new Error('first stroke was not sent')
    answer(fake, request1)
    const edits1 = await pendingFirst
    if (!edits1) throw new Error('first stroke was dropped')

    let state = sceneOf()
    let history = emptyHistory<SceneState>()
    ;[state, history] = run(state, history, sculptRelief('terrain', 'sculpt', edits1))
    sculptor.note(sculptOf(state))

    const pendingSecond = sculptor.raiseDisk(second)
    ;[state, history] = undo(state, history)
    sculptor.note(sculptOf(state))

    const request2 = fake.posted[1]
    if (!request2) throw new Error('second stroke was not sent')
    answer(fake, request2)
    const edits2 = await pendingSecond
    if (edits2) state = run(state, history, sculptRelief('terrain', 'sculpt', edits2))[0]

    expect(edits2).toBeNull()
    expect(sculptOf(state)).toBeUndefined()
  })
})

function sceneOf(sculpt?: ReliefSculpt): SceneState {
  return {
    ...EMPTY_SCENE,
    world: {
      ...DEFAULT_WORLD,
      layers: [reliefLayer({ assetId: 'asset_height' }, { edits: [terrainEditLayer({ sculpt })] })],
    },
  }
}

function sculptOf(state: SceneState): ReliefSculpt | undefined {
  const layer = state.world.layers[0]
  return layer?.kind === 'relief' ? layer.edits[0]?.sculpt : undefined
}

function operationOf(stroke: ReturnType<typeof diskAt>): ReliefSculptOperation {
  return { kind: 'raiseDisk', disk: stroke.disk, amount: stroke.amount }
}
