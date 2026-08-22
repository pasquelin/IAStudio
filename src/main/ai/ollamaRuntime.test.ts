import { describe, expect, it, vi } from 'vitest'
import { localModel } from '@shared/domain/localModel-fixtures'
import type { ChatRequest } from './localRuntimes'
import { ollamaLocalRuntime, type OllamaPort } from './ollamaRuntime'

const QWEN = localModel({
  id: 'qwen3:8b',
  name: 'qwen3:8b',
  format: 'gguf',
  loader: 'ollama',
  files: [],
})

const port = (over: Partial<OllamaPort> = {}): OllamaPort => ({
  tags: () => Promise.resolve([{ name: 'qwen3:8b', size: 5_000_000_000 }]),
  pull: () => Promise.resolve(),
  remove: () => Promise.resolve(),
  chat: () => Promise.resolve('answered'),
  ...over,
})

const request: ChatRequest = {
  model: 'qwen3:8b',
  contextTokens: 4096,
  messages: [{ role: 'user', content: 'hi' }],
  json: false,
}

describe('ollamaLocalRuntime', () => {
  it('reads ready and installed when the service answers', async () => {
    const reading = await ollamaLocalRuntime(port()).read([QWEN])

    expect(reading.ready).toBe(true)
    expect(reading.installed.has('qwen3:8b')).toBe(true)
  })

  it('reads not ready when nothing answers and nothing can start it', async () => {
    const reading = await ollamaLocalRuntime(
      port({ tags: () => Promise.reject(new Error('ECONNREFUSED')) }),
    ).read([QWEN])

    expect(reading).toEqual({ ready: false, installed: new Set(), loaded: new Set() })
  })

  it('retries the listing after ensure brings the service up', async () => {
    let up = false
    const tags = vi.fn(() =>
      up
        ? Promise.resolve([{ name: 'qwen3:8b', size: 5_000_000_000 }])
        : Promise.reject(new Error('ECONNREFUSED')),
    )
    const reading = await ollamaLocalRuntime(port({ tags }), {
      ensure: async () => {
        up = true
        return true
      },
    }).read([QWEN])

    expect(reading.ready).toBe(true)
    expect(reading.installed.has('qwen3:8b')).toBe(true)
    expect(tags).toHaveBeenCalledTimes(2)
  })

  it('does not call remove when a chat fails — a missing tag is not ours to delete', async () => {
    const remove = vi.fn()
    const onStale = vi.fn()
    const runtime = ollamaLocalRuntime(
      port({ remove, chat: () => Promise.reject(new Error('404')) }),
      {
        onStale,
      },
    )

    await expect(runtime.chat?.(request)).rejects.toThrow(/404/)
    expect(remove).not.toHaveBeenCalled()
    expect(onStale).toHaveBeenCalledOnce()
  })

  it('discovers chat tags and skips embeddings', async () => {
    const runtime = ollamaLocalRuntime(
      port({
        tags: () =>
          Promise.resolve([
            { name: 'qwen3:8b', size: 5_000_000_000 },
            { name: 'nomic-embed-text', size: 270_000_000 },
          ]),
      }),
    )

    expect((await runtime.discover?.())?.map(model => model.id)).toEqual(['qwen3:8b'])
  })

  it('discovers nothing when the service is down', async () => {
    const runtime = ollamaLocalRuntime(
      port({ tags: () => Promise.reject(new Error('ECONNREFUSED')) }),
    )

    expect(await runtime.discover?.()).toEqual([])
  })

  it('asks the service once when discover and read run together', async () => {
    const tags = vi.fn(() => Promise.resolve([{ name: 'qwen3:8b', size: 5_000_000_000 }]))
    const runtime = ollamaLocalRuntime(port({ tags }))

    await Promise.all([runtime.discover?.(), runtime.read([QWEN])])

    expect(tags).toHaveBeenCalledOnce()
  })

  it('pulls, deletes and chats by the tag name', async () => {
    const pull = vi.fn(() => Promise.resolve())
    const remove = vi.fn(() => Promise.resolve())
    const chat = vi.fn(() => Promise.resolve('hi'))
    const runtime = ollamaLocalRuntime(port({ pull, remove, chat }))

    await runtime.install(QWEN, () => {}, new AbortController().signal)
    await runtime.remove(QWEN)
    expect(await runtime.chat?.(request)).toBe('hi')
    expect(pull).toHaveBeenCalledWith('qwen3:8b', expect.any(Function), expect.any(AbortSignal))
    expect(remove).toHaveBeenCalledWith('qwen3:8b')
    expect(chat).toHaveBeenCalledWith(request)
  })
})
