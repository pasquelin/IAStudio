import { BufferGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MATERIAL } from '../scene/sceneState'
import { csgPartOf, type CsgGraph } from '@shared/domain/csg'
import { csgGraphOf } from './csg-fixtures'
import { createCsgEvaluator } from './csgEvaluator'
import type { CsgRequest, CsgResponse } from './csgMessage'

function fakeWorker() {
  const listeners: ((event: MessageEvent<CsgResponse>) => void)[] = []
  const sent: CsgRequest[] = []
  const worker = {
    postMessage: (message: CsgRequest) => sent.push(message),
    addEventListener: (type: string, listener: (event: MessageEvent<CsgResponse>) => void) => {
      if (type === 'message') listeners.push(listener)
    },
    terminate: vi.fn(),
  } as unknown as Worker

  return {
    worker,
    sent,
    /** Answers the request still out with a one-triangle solid, which is all the caller reads. */
    succeed: () => {
      const request = sent.at(-1)
      if (!request) throw new Error('nothing was sent to the worker')
      for (const listener of listeners) {
        listener({
          data: {
            id: request.id,
            ok: true,
            mesh: {
              position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
              normal: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
              uv: new Float32Array([0, 0, 1, 0, 0, 1]),
              index: null,
            },
          },
        } as MessageEvent<CsgResponse>)
      }
    },
    fail: (error: string) => {
      const request = sent.at(-1)
      if (!request) throw new Error('nothing was sent to the worker')
      for (const listener of listeners) {
        listener({ data: { id: request.id, ok: false, error } } as MessageEvent<CsgResponse>)
      }
    },
  }
}

const wall = (): CsgGraph =>
  csgGraphOf(csgPartOf('wall', { kind: 'box', width: 4, height: 3, depth: 0.2 }, DEFAULT_MATERIAL))

describe('createCsgEvaluator', () => {
  it('hands the same geometry to two holders of one graph, and cuts once', async () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    const first = evaluator.acquire(wall())
    const second = evaluator.acquire(wall())
    fake.succeed()

    expect(await first).toBe(await second)
    expect(fake.sent).toHaveLength(1)
  })

  it('disposes the geometry once the last holder lets go', async () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    const acquired = evaluator.acquire(wall())
    fake.succeed()
    const geometry = await acquired
    if (!geometry) throw new Error('the cut answered nothing')
    const disposed = vi.spyOn(geometry, 'dispose')

    evaluator.release(wall())
    expect(disposed).toHaveBeenCalledOnce()
  })

  it('cuts again once a released solid is asked for anew', async () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    const acquired = evaluator.acquire(wall())
    fake.succeed()
    await acquired
    evaluator.release(wall())

    void evaluator.acquire(wall())
    expect(fake.sent).toHaveLength(2)
  })

  it('leaves the caller without a solid when the cut fails, and says so once', async () => {
    const fake = fakeWorker()
    const onFailure = vi.fn()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure })

    const acquired = evaluator.acquire(wall())
    fake.fail('degenerate brush')

    expect(await acquired).toBeNull()
    // The key as subject, so two solids that both fail are two lines in the log rather than one.
    expect(onFailure).toHaveBeenCalledWith(expect.stringContaining('box'), expect.any(Error))
  })

  it('sends the graph itself, not a mesh', async () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    void evaluator.acquire(wall())
    expect(fake.sent.at(-1)?.graph.base.geometry).toEqual({
      kind: 'box',
      width: 4,
      height: 3,
      depth: 0.2,
    })
  })

  it('claims the geometries it lends, and nothing else', () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    expect(evaluator.owns(new BufferGeometry())).toBe(false)
  })

  // What tells a holder it must not dispose: the same buffers are drawn by every node of the
  // same graph, and freeing them under a neighbour empties its screen with every gate green.
  it('claims a geometry it handed out, so no holder disposes it', async () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    const acquired = evaluator.acquire(wall())
    fake.succeed()
    const geometry = await acquired
    if (!geometry) throw new Error('the cut answered nothing')

    expect(evaluator.owns(geometry)).toBe(true)
  })

  it('stops the worker when the engine goes', () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    void evaluator.acquire(wall())
    evaluator.dispose()
    expect(fake.worker.terminate).toHaveBeenCalledOnce()
  })
  /**
   * The claim the whole cache rests on, at the scale an editor actually reaches: two hundred
   * identical windows are one mesh and one evaluation, not two hundred of each.
   */
  it('cuts once for two hundred identical solids, and holds one geometry', async () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    const asked = Array.from({ length: 200 }, () => evaluator.acquire(wall()))
    fake.succeed()
    const geometries = await Promise.all(asked)

    expect(fake.sent).toHaveLength(1)
    expect(new Set(geometries).size).toBe(1)
  })

  it('keeps the mesh while any holder is left, and frees it at the last', async () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    const asked = Array.from({ length: 3 }, () => evaluator.acquire(wall()))
    fake.succeed()
    const geometry = (await Promise.all(asked))[0]
    if (!geometry) throw new Error('the cut answered nothing')
    const disposed = vi.spyOn(geometry, 'dispose')

    evaluator.release(wall())
    evaluator.release(wall())
    expect(disposed).not.toHaveBeenCalled()

    evaluator.release(wall())
    expect(disposed).toHaveBeenCalledOnce()
  })
})
