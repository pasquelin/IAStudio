import { createDefaultScene } from '@/engines/scene/defaultScene'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { describe, expect, it } from 'vitest'
import { createSceneDocumentCodec } from './sceneDocumentCodec'

class CodecWorker extends EventTarget {
  readonly messages: unknown[] = []
  terminated = false
  postMessage(message: unknown): void {
    this.messages.push(message)
  }
  terminate(): void {
    this.terminated = true
  }
  answer(data: unknown): void {
    this.dispatchEvent(new MessageEvent('message', { data }))
  }
  fail(message: string): void {
    const event = new Event('error')
    Object.defineProperty(event, 'message', { value: message })
    this.dispatchEvent(event)
  }
}

const options = { nodes: 1, chunkNodes: 2, timeoutMs: 1_000, yieldWork: () => Promise.resolve() }

describe('sceneDocumentCodec', () => {
  it('keeps small scenes on the calling thread', async () => {
    const worker = new CodecWorker()
    const codec = createSceneDocumentCodec(() => worker as unknown as Worker, {
      ...options,
      nodes: 100,
    })
    const encoded = await codec.encode(createDefaultScene(), 'scene-1')
    expect(JSON.parse(encoded)).toMatchObject({ asset: { version: '2.0' } })
    expect(worker.messages).toEqual([])
  })

  it('sends bounded chunks, assembles exact bytes, and keeps saves FIFO', async () => {
    const worker = new CodecWorker()
    const codec = createSceneDocumentCodec(() => worker as unknown as Worker, {
      ...options,
      nodes: 5,
    })
    const state = {
      ...createDefaultScene(),
      nodes: Array.from({ length: 5 }, (_, at) => meshNode(`mesh-${at}`)),
    }
    const first = codec.encode(state, 'scene-1')
    const second = codec.encode(createDefaultScene(), 'scene-1')
    await new Promise(resolve => setTimeout(resolve, 0))
    const messages = worker.messages as Array<{ id: number; operation: string; nodes?: unknown[] }>
    expect(new Set(messages.map(message => message.id))).toEqual(new Set([1]))
    expect(messages.filter(message => message.operation === 'encodeNodes')).toHaveLength(3)
    expect(messages.flatMap(message => message.nodes ?? []).length).toBe(5)
    expect(messages.every(message => (message.nodes?.length ?? 0) <= 2)).toBe(true)
    worker.answer({ id: 1, done: false, index: 0, content: '{"first":' })
    worker.answer({ id: 1, done: false, index: 1, content: 'true}' })
    worker.answer({ id: 1, done: true, ok: true, chunks: 2, characters: 14 })
    await expect(first).resolves.toBe('{"first":true}')
    await expect(second).resolves.toEqual(expect.stringContaining('"version":"2.0"'))
    expect(worker.messages.some(message => JSON.stringify(message).includes('"id":2'))).toBe(false)
  })

  it('rejects an out-of-order answer instead of assembling a corrupt file', async () => {
    const worker = new CodecWorker()
    const codec = createSceneDocumentCodec(() => worker as unknown as Worker, options)
    const encoding = codec.encode({ ...createDefaultScene(), nodes: [meshNode('one')] }, 'scene-1')
    await Promise.resolve()
    worker.answer({ id: 1, done: false, index: 1, content: 'skipped zero' })
    await expect(encoding).rejects.toThrow('chunk 1 out of order')
  })

  it('rejects a worker answer whose declared length is incomplete', async () => {
    const worker = new CodecWorker()
    const codec = createSceneDocumentCodec(() => worker as unknown as Worker, options)
    const encoding = codec.encode({ ...createDefaultScene(), nodes: [meshNode('one')] }, 'scene-1')
    await Promise.resolve()
    worker.answer({ id: 1, done: false, index: 0, content: '{"cut"' })
    worker.answer({ id: 1, done: true, ok: true, chunks: 2, characters: 12 })
    await expect(encoding).rejects.toThrow('incomplete file')
  })

  it('cancels an active encoding when its document incarnation ends', async () => {
    const worker = new CodecWorker()
    const codec = createSceneDocumentCodec(() => worker as unknown as Worker, options)
    const controller = new AbortController()
    const encoding = codec.encode(
      { ...createDefaultScene(), nodes: [meshNode('one')] },
      'scene-1',
      controller.signal,
    )
    await Promise.resolve()

    controller.abort()

    await expect(encoding).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.messages.some(message => JSON.stringify(message).includes('"cancel":true'))).toBe(
      true,
    )
  })

  it('restarts after a worker crash without blocking the next save', async () => {
    const workers: CodecWorker[] = []
    const codec = createSceneDocumentCodec(() => {
      const worker = new CodecWorker()
      workers.push(worker)
      return worker as unknown as Worker
    }, options)
    const state = { ...createDefaultScene(), nodes: [meshNode('one')] }
    const failed = codec.encode(state, 'scene-1')
    await Promise.resolve()
    workers[0]?.fail('driver stopped')
    await expect(failed).rejects.toThrow('scene document worker failed: driver stopped')
    const retried = codec.encode(state, 'scene-1')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(workers).toHaveLength(2)
    workers[1]?.answer({ id: 2, done: false, index: 0, content: '{"ok":true}' })
    workers[1]?.answer({ id: 2, done: true, ok: true, chunks: 1, characters: 11 })
    await expect(retried).resolves.toBe('{"ok":true}')
  })

  it('terminates a timed-out worker before retrying on a fresh one', async () => {
    const workers: CodecWorker[] = []
    const codec = createSceneDocumentCodec(
      () => {
        const worker = new CodecWorker()
        workers.push(worker)
        return worker as unknown as Worker
      },
      { ...options, timeoutMs: 5 },
    )
    const state = { ...createDefaultScene(), nodes: [meshNode('one')] }

    await expect(codec.encode(state, 'scene-1')).rejects.toThrow('timed out')
    expect(workers[0]?.terminated).toBe(true)

    const retried = codec.encode(state, 'scene-1')
    await new Promise(resolve => setTimeout(resolve, 0))
    workers[1]?.answer({ id: 2, done: false, index: 0, content: '{"ok":true}' })
    workers[1]?.answer({ id: 2, done: true, ok: true, chunks: 1, characters: 11 })
    await expect(retried).resolves.toBe('{"ok":true}')
  })

  it('terminates a worker that rejects a later input chunk', async () => {
    class RejectingWorker extends CodecWorker {
      override postMessage(message: unknown): void {
        super.postMessage(message)
        if (this.messages.length === 2) throw new Error('cannot clone chunk')
      }
    }
    const failedWorker = new RejectingWorker()
    const replacement = new CodecWorker()
    const workers = [failedWorker, replacement]
    const codec = createSceneDocumentCodec(() => workers.shift() as unknown as Worker, options)
    const state = { ...createDefaultScene(), nodes: [meshNode('one')] }

    await expect(codec.encode(state, 'scene-1')).rejects.toThrow('rejected a chunk')
    expect(failedWorker.terminated).toBe(true)
    const retried = codec.encode(state, 'scene-1')
    await new Promise(resolve => setTimeout(resolve, 0))
    replacement.answer({ id: 2, done: false, index: 0, content: '{"ok":true}' })
    replacement.answer({ id: 2, done: true, ok: true, chunks: 1, characters: 11 })
    await expect(retried).resolves.toBe('{"ok":true}')
  })

  it('does not restart queued work after disposal', async () => {
    const workers: CodecWorker[] = []
    const codec = createSceneDocumentCodec(() => {
      const worker = new CodecWorker()
      workers.push(worker)
      return worker as unknown as Worker
    }, options)
    const state = { ...createDefaultScene(), nodes: [meshNode('one')] }
    const active = codec.encode(state, 'scene-1')
    const queued = codec.encode(state, 'scene-1')
    await Promise.resolve()

    codec.dispose()

    await expect(active).rejects.toMatchObject({ name: 'AbortError' })
    await expect(queued).rejects.toMatchObject({ name: 'AbortError' })
    expect(workers).toHaveLength(1)
  })
})
