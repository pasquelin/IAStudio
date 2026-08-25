import { describe, expect, it, vi } from 'vitest'
import { csgGraphOf, csgPartOf, type CsgGraph } from '@shared/domain/csg'
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
              triangles: 1,
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
  csgGraphOf(csgPartOf('wall', { kind: 'box', width: 4, height: 3, depth: 0.2 }))

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
    expect(onFailure).toHaveBeenCalledOnce()
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

  it('stops the worker when the engine goes', () => {
    const fake = fakeWorker()
    const evaluator = createCsgEvaluator({ spawn: () => fake.worker, onFailure: vi.fn() })

    void evaluator.acquire(wall())
    evaluator.dispose()
    expect(fake.worker.terminate).toHaveBeenCalledOnce()
  })
})
