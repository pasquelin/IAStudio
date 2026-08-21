import { describe, expect, it } from 'vitest'
import type { DownloadProgress } from '@shared/domain/localModel'
import { localModel } from '@shared/domain/localModel-fixtures'
import { PROGRESS_STEP } from '@shared/domain/taskProgress'
import {
  createOllamaClient,
  linesOf,
  ollamaLocalRuntime,
  type OllamaClient,
  type OllamaPort,
  type OllamaReply,
} from './ollamaRuntime'

const streamOf = async function* (parts: readonly string[]): AsyncIterable<string> {
  for (const part of parts) yield part
}

const replying = (parts: readonly string[], over: Partial<OllamaReply> = {}): OllamaReply => ({
  ok: true,
  status: 200,
  chunks: streamOf(parts),
  ...over,
})

/** A port that answers each path from a table, and records what it was sent. */
const portOf = (answers: Record<string, OllamaReply>) => {
  const sent: { path: string; body: unknown }[] = []

  const port: OllamaPort = {
    send: (_method, path, body) => {
      sent.push({ path, body })
      return Promise.resolve(answers[path] ?? replying([], { ok: false, status: 404 }))
    },
  }

  return { port, sent }
}

describe('linesOf', () => {
  /**
   * A chunk boundary lands mid-object often enough to matter and never where a test would happen
   * to put it — and the last line often arrives without its newline.
   */
  it('makes whole lines out of chunks cut anywhere', async () => {
    const lines: string[] = []
    for await (const line of linesOf(streamOf(['{"a":', '1}\n{"b":2}']))) lines.push(line)

    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })
})

describe('the Ollama client', () => {
  it('lists the tags the server holds', async () => {
    const { port } = portOf({
      '/api/tags': replying(['{"models":[{"name":"llama3.2:3b"},{"name":"qwen:4b"}]}']),
    })

    await expect(createOllamaClient(port).installedNames()).resolves.toEqual([
      'llama3.2:3b',
      'qwen:4b',
    ])
  })

  // Raising is how "the server is down" is reported: `runtimeReadingsOf` catches it and answers
  // that the runtime is not ready, which is what the manager shows.
  it('raises rather than answering an empty list when nothing replies', async () => {
    const { port } = portOf({})

    await expect(createOllamaClient(port).installedNames()).rejects.toThrow()
  })

  /**
   * 🛑 `[M]` Measured 2026-08-21 on an unknown tag: a pull that fails answers **HTTP 200** with
   * `{"error": …}` in the stream. Reading the status code alone reports a download that never
   * happened as a success.
   */
  it('refuses a pull whose stream carries an error, whatever the status code said', async () => {
    const { port } = portOf({
      '/api/pull': replying([
        '{"status":"pulling manifest"}\n',
        '{"error":"pull model manifest: file does not exist"}\n',
      ]),
    })

    await expect(
      createOllamaClient(port).pull('nope:0b', () => {}, new AbortController().signal),
    ).rejects.toThrow(/file does not exist/)
  })

  // A stream that stops short of `success` left the weights half there, and a runtime that took
  // its silence for completion would report a model as installed.
  it('refuses a pull that ends without saying it succeeded', async () => {
    const { port } = portOf({ '/api/pull': replying(['{"status":"pulling manifest"}\n']) })

    await expect(
      createOllamaClient(port).pull('llama3.2:3b', () => {}, new AbortController().signal),
    ).rejects.toThrow()
  })

  /**
   * `total` in the stream is a LAYER's, never the model's. Summing the lines would count the same
   * bytes again on every report, so what is summed is the last figure of each digest.
   */
  it('adds up the layers rather than the lines', async () => {
    const seen: number[] = []
    const { port } = portOf({
      '/api/pull': replying([
        '{"status":"pulling a","digest":"a","total":100,"completed":40}\n',
        '{"status":"pulling a","digest":"a","total":100,"completed":100}\n',
        '{"status":"pulling b","digest":"b","total":10,"completed":10}\n',
        '{"status":"success"}\n',
      ]),
    })

    await createOllamaClient(port).pull(
      'llama3.2:3b',
      received => seen.push(received),
      new AbortController().signal,
    )

    expect(seen).toEqual([40, 100, 110])
  })

  /**
   * `[M]` The founding measurement of ADR-18: `keep_alive` and `options.num_ctx` are honoured on
   * this door and ignored on `/v1/chat/completions`. Sending them elsewhere would be a no-op the
   * studio could not see.
   */
  it('asks the native door for the window and the residency it honours', async () => {
    const { port, sent } = portOf({ '/api/chat': replying(['{"message":{"content":"{}"}}']) })

    await createOllamaClient(port).chat({
      model: 'llama3.2:3b',
      messages: [{ role: 'user', content: 'hi' }],
      contextTokens: 8192,
      json: true,
    })

    expect(sent[0]?.path).toBe('/api/chat')
    expect(sent[0]?.body).toMatchObject({
      format: 'json',
      options: { num_ctx: 8192 },
      stream: false,
    })
  })

  /**
   * 🛑 `/api/delete` answers 200 with an EMPTY body. Reading it as JSON made every successful
   * removal report a failure: the weights gone, the row still saying "installed", and an error
   * handed to a window that had nothing to do with it.
   */
  it('takes an empty body as a removal that happened', async () => {
    const { port, sent } = portOf({ '/api/delete': replying([]) })

    await expect(createOllamaClient(port).remove('llama3.2:3b')).resolves.toBeUndefined()
    expect(sent[0]).toEqual({ path: '/api/delete', body: { model: 'llama3.2:3b' } })
  })

  it('refuses a removal the server turned down', async () => {
    const { port } = portOf({
      '/api/delete': replying(['model not found'], { ok: false, status: 404 }),
    })

    await expect(createOllamaClient(port).remove('nope:0b')).rejects.toThrow(/404/)
  })

  /**
   * 🛑 `keep_alive: -1` pins 8.2 GB for as long as the server lives, and nothing in this studio can
   * unload them: quitting left the memory taken, and `freemem()` falling made the next turn read
   * the machine as too small for the very model answering it — moving the conversation to a BILLED
   * cloud without a word.
   */
  it('never asks the server to pin the model in memory', async () => {
    const { port, sent } = portOf({ '/api/chat': replying(['{"message":{"content":"{}"}}']) })

    await createOllamaClient(port).chat({
      model: 'llama3.2:3b',
      messages: [],
      contextTokens: 8192,
      json: true,
    })

    expect(sent[0]?.body).not.toHaveProperty('keep_alive')
  })

  it('hands back what the model said', async () => {
    const { port } = portOf({
      '/api/chat': replying(['{"message":{"content":"{\\"say\\":\\"ok\\"}"}}']),
    })

    await expect(
      createOllamaClient(port).chat({
        model: 'llama3.2:3b',
        messages: [],
        contextTokens: 2048,
        json: false,
      }),
    ).resolves.toBe('{"say":"ok"}')
  })
})

describe('Ollama as a runtime of this studio', () => {
  const llama = localModel({ id: 'llama3.2:3b', loader: 'ollama', files: [], diskBytes: 2_000 })

  const clientOf = (over: Partial<OllamaClient>): OllamaClient => ({
    ...createOllamaClient(portOf({}).port),
    ...over,
  })

  it('holds a catalogue model the server lists under the same tag', async () => {
    const client = clientOf({
      installedNames: () => Promise.resolve(['llama3.2:3b', 'something-else']),
    })

    await expect(ollamaLocalRuntime(client).read([llama])).resolves.toEqual({
      ready: true,
      installed: new Set(['llama3.2:3b']),
    })
  })

  /**
   * 🛑 Ollama reports on a ~60 ms ticker rather than per byte, so a SLOW network would broadcast
   * MORE — the opposite of what a threshold in bytes does. Throttled at the step the file
   * downloads already use, and the last word is said once the STREAM has ended.
   */
  it('speaks every four mebibytes at most, and once more when the stream ends', async () => {
    const steps: DownloadProgress[] = []
    const whole = 3 * PROGRESS_STEP
    const client = clientOf({
      pull: (_name, onReceived) => {
        for (const received of [1, 2, PROGRESS_STEP, PROGRESS_STEP + 1, whole]) onReceived(received)
        return Promise.resolve()
      },
    })

    await ollamaLocalRuntime(client).install(
      localModel({ ...llama, diskBytes: whole }),
      step => steps.push(step),
      new AbortController().signal,
    )

    expect(steps).toEqual([
      { received: PROGRESS_STEP, total: whole },
      { received: whole, total: whole },
    ])
  })

  /**
   * 🛑 The manifest DECLARES a size where the stream MEASURES one, and an Ollama tag is mutable.
   * A first draft ended the throttle on `received >= diskBytes`: past that point every one of the
   * ~16 lines a second broadcast an overview to every window, and the bar sat pinned at 100 %.
   */
  it('keeps throttling, and keeps counting, past the size the manifest declared', async () => {
    const steps: DownloadProgress[] = []
    const declared = PROGRESS_STEP
    const client = clientOf({
      pull: (_name, onReceived) => {
        for (const received of [declared, declared + 1, declared + 2, 3 * declared]) {
          onReceived(received)
        }
        return Promise.resolve()
      },
    })

    await ollamaLocalRuntime(client).install(
      localModel({ ...llama, diskBytes: declared }),
      step => steps.push(step),
      new AbortController().signal,
    )

    expect(steps).toEqual([
      { received: declared, total: declared },
      { received: 3 * declared, total: 3 * declared },
    ])
  })
})
