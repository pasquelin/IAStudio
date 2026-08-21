import { describe, expect, it, vi } from 'vitest'
import { localModel } from '@shared/domain/localModel-fixtures'
import type { LocalRuntime } from './localRuntimes'
import { llamaLocalRuntime, type LlamaPort } from './llamaRuntime'

const MODEL = localModel({ id: 'qwen', loader: 'llamacpp' })

const files = (over: Partial<LocalRuntime> = {}): LocalRuntime => ({
  read: () => Promise.resolve({ ready: true, installed: new Set(['qwen']) }),
  install: () => Promise.resolve(),
  remove: () => Promise.resolve(),
  ...over,
})

const port = (over: Partial<LlamaPort> = {}): LlamaPort => ({
  ready: () => true,
  chat: () => Promise.resolve('answered'),
  ...over,
})

const runtime = (over: { files?: LocalRuntime; port?: LlamaPort } = {}): LocalRuntime =>
  llamaLocalRuntime({
    files: over.files ?? files(),
    port: over.port ?? port(),
    weightsOf: model => `/models/${model.files[0]?.name ?? model.id}`,
    modelOf: id => (id === 'qwen' ? MODEL : null),
  })

const request = { model: 'qwen', contextTokens: 4096, messages: [], json: false }

describe('llamaLocalRuntime', () => {
  /**
   * The disk and the ADDON answer different questions. Weights that are present with nothing able
   * to open them read as a runtime that is not answering — which is the gesture the screen asks
   * for — where "not installed" would ask for a download that changes nothing.
   */
  it('reads a model as installed and its runtime as absent when the addon cannot open it', async () => {
    const reading = await runtime({ port: port({ ready: () => false }) }).read([MODEL])

    expect(reading.installed.has('qwen')).toBe(true)
    expect(reading.ready).toBe(false)
  })

  it('reads the runtime as answering when the addon is there', async () => {
    expect((await runtime().read([MODEL])).ready).toBe(true)
  })

  // Installing is the file half, unchanged: the weights are ordinary files with a digest, and the
  // downloader that fetches them was written long before this runtime existed.
  it('installs and removes through the file runtime it was handed', async () => {
    const install = vi.fn(() => Promise.resolve())
    const remove = vi.fn(() => Promise.resolve())

    const local = runtime({ files: files({ install, remove }) })
    await local.install(MODEL, () => {}, new AbortController().signal)
    await local.remove(MODEL)

    expect(install).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()
  })

  it('converses through the port, on the weights the model names', async () => {
    const chat = vi.fn(() => Promise.resolve('answered'))

    expect(await runtime({ port: port({ chat }) }).chat?.(request)).toBe('answered')
    expect(chat).toHaveBeenCalledWith(request, `/models/${MODEL.files[0]?.name ?? 'qwen'}`)
  })

  /**
   * Raised rather than answered empty: an empty answer reads as a model that had nothing to add,
   * where this is the studio having nothing to run — and the window marks a rejected turn LOST.
   */
  it('refuses a turn naming a model the catalogue does not hold', async () => {
    await expect(runtime().chat?.({ ...request, model: 'gone' })).rejects.toThrow(/catalogue/)
  })
})
