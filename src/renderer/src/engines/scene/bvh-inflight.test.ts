import { describe, expect, it, vi } from 'vitest'
import { createInflightBuilds } from './bvh-inflight'
import type { BvhRequest, SerializedBvh } from './bvh-message'

/** A worker that only records what it was handed — the exchange is what this measures. */
function recordingWorker() {
  const sent: BvhRequest[] = []
  const worker = { postMessage: (request: BvhRequest) => sent.push(request) }
  // `as`: the register calls `postMessage` and nothing else, and jsdom spawns no worker.
  return { sent, worker: worker as unknown as Worker }
}

function refusingWorker(reason: string): Worker {
  const worker = {
    postMessage: vi.fn(() => {
      throw new Error(reason)
    }),
  }
  // `as`: same reason as above.
  return worker as unknown as Worker
}

const aRequest = (): Omit<BvhRequest, 'id'> => ({
  position: new Float32Array([0, 0, 0]),
  index: null,
})

const tree: SerializedBvh = { version: 1, roots: [], index: null, indirectBuffer: null }

describe('createInflightBuilds', () => {
  it('starts with nothing out', () => {
    expect(createInflightBuilds().size).toBe(0)
  })

  it('numbers every request it sends, so two can never collide', () => {
    const inflight = createInflightBuilds()
    const { sent, worker } = recordingWorker()

    void inflight.send(worker, aRequest())
    void inflight.send(worker, aRequest())

    expect(sent.map(request => request.id)).toEqual([1, 2])
    expect(inflight.size).toBe(2)
  })

  it('hands the buffers over rather than copying them across', () => {
    const inflight = createInflightBuilds()
    const postMessage = vi.fn()
    // `as`: the register calls `postMessage` and nothing else.
    const worker = { postMessage } as unknown as Worker

    const index = new Uint32Array([0, 1, 2])
    void inflight.send(worker, { ...aRequest(), index })

    const [request, transferables] = postMessage.mock.calls[0] ?? []
    expect(transferables).toEqual([request.position.buffer, index.buffer])
  })

  // The defect this register exists for: the slot used to be recorded before the throw.
  it('records nothing for a request the worker refused to take', async () => {
    const inflight = createInflightBuilds()

    await expect(inflight.send(refusingWorker('could not clone'), aRequest())).rejects.toThrow(
      'could not clone',
    )

    expect(inflight.size).toBe(0)
  })

  it('keeps its numbering after a refusal, so the next request is still its own', () => {
    const inflight = createInflightBuilds()
    const { sent, worker } = recordingWorker()

    void inflight.send(refusingWorker('refused'), aRequest()).catch(() => undefined)
    void inflight.send(worker, aRequest())

    expect(sent.map(request => request.id)).toEqual([2])
  })

  it('answers the request the response names, and lets go of it', async () => {
    const inflight = createInflightBuilds()
    const { worker } = recordingWorker()

    const waiting = inflight.send(worker, aRequest())
    inflight.settle({ id: 1, ok: true, bvh: tree })

    await expect(waiting).resolves.toBe(tree)
    expect(inflight.size).toBe(0)
  })

  it('rejects the one whose build threw', async () => {
    const inflight = createInflightBuilds()
    const { worker } = recordingWorker()

    const waiting = inflight.send(worker, aRequest())
    inflight.settle({ id: 1, ok: false, error: 'out of memory' })

    await expect(waiting).rejects.toThrow('out of memory')
    expect(inflight.size).toBe(0)
  })

  // A worker replaced mid-build still answers once, and that answer names an id nothing awaits.
  it('drops an answer nobody is waiting for', () => {
    const inflight = createInflightBuilds()

    expect(() => inflight.settle({ id: 404, ok: true, bvh: tree })).not.toThrow()
    expect(inflight.size).toBe(0)
  })

  it('tells everyone waiting why the worker went, and keeps none of them', async () => {
    const inflight = createInflightBuilds()
    const { worker } = recordingWorker()

    const first = inflight.send(worker, aRequest())
    const second = inflight.send(worker, aRequest())
    inflight.failAll('BVH worker failed: killed')

    await expect(first).rejects.toThrow('killed')
    await expect(second).rejects.toThrow('killed')
    expect(inflight.size).toBe(0)
  })

  it('answers everyone waiting with nothing when the engine goes', async () => {
    const inflight = createInflightBuilds()
    const { worker } = recordingWorker()

    const waiting = inflight.send(worker, aRequest())
    inflight.resolveAll()

    await expect(waiting).resolves.toBeNull()
    expect(inflight.size).toBe(0)
  })
})
