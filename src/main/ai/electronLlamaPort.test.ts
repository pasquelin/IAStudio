import { describe, expect, it, vi } from 'vitest'
import type { ChatHistoryItem } from 'node-llama-cpp'

/**
 * The addon stands in, and only the two calls that carry a conversation are watched.
 *
 * `node-llama-cpp` opens a GPU and reads gigabytes of weights; what has to be exercised here is
 * what the studio HANDS it — which is where the briefing was being dropped.
 */
const setChatHistory = vi.fn<(history: ChatHistoryItem[]) => void>()
const prompt = vi.fn(() => Promise.resolve('{"say":"done","calls":[]}'))
const createContext = vi.fn(() =>
  Promise.resolve({ getSequence: () => ({}), dispose: () => Promise.resolve() }),
)
const disposeModel = vi.fn(() => Promise.resolve())
const disposeLlama = vi.fn(() => Promise.resolve())
const seeded: (string | undefined)[] = []
const contextSizes: unknown[] = []

vi.mock('node-llama-cpp', () => ({
  getLlama: () =>
    Promise.resolve({
      loadModel: () =>
        Promise.resolve({
          size: 1_000,
          dispose: disposeModel,
          createContext: (options: { contextSize?: unknown }) => {
            contextSizes.push(options.contextSize)
            return createContext()
          },
        }),
      getGrammarFor: () => Promise.resolve({}),
      getVramState: () => Promise.resolve({ total: 0, used: 0, free: 0, unifiedSize: 0 }),
      dispose: disposeLlama,
    }),
  LlamaChatSession: class {
    constructor(options: { systemPrompt?: string }) {
      seeded.push(options.systemPrompt)
    }
    setChatHistory = setChatHistory
    prompt = prompt
  },
}))

const { electronLlamaPort } = await import('./electronLlamaPort')

const ask = async (messages: { role: 'system' | 'user' | 'assistant'; content: string }[]) => {
  await electronLlamaPort().chat(
    { model: 'qwen', contextTokens: 32_768, messages, json: false },
    '/weights/qwen.gguf',
  )
}

const BRIEFING = 'You are the studio assistant.'

describe('electronLlamaPort', () => {
  /**
   * 🛑 `setChatHistory` REPLACES what the constructor seeded. Handed the spoken turns alone, it
   * dropped the briefing outright — every local turn ran without the instructions that teach the
   * model the JSON shape `parseReply` then has to read back.
   */
  it('keeps the briefing in the history it hands over', async () => {
    setChatHistory.mockClear()

    await ask([
      { role: 'system', content: BRIEFING },
      { role: 'user', content: 'first' },
      { role: 'user', content: 'second' },
    ])

    expect(setChatHistory).toHaveBeenCalledWith([
      { type: 'system', text: BRIEFING },
      { type: 'user', text: 'first' },
    ])
  })

  /**
   * `prompt` MERGES into a trailing user turn rather than appending after it. With the sentence
   * left in the history, the model was asked it twice, separated by a blank line.
   */
  it('asks the last sentence once, and only through the prompt', async () => {
    setChatHistory.mockClear()
    prompt.mockClear()

    await ask([
      { role: 'system', content: BRIEFING },
      { role: 'user', content: 'the only thing said' },
    ])

    // Nothing but the briefing would be left, so no history is handed over at all.
    expect(setChatHistory).not.toHaveBeenCalled()
    expect(prompt).toHaveBeenCalledWith('the only thing said', expect.anything())
  })

  /**
   * A CEILING, not a demand: a manifest may declare the window the weights were trained for —
   * 131 072 tokens on a recent Llama — and allocating that attention cache outright fails.
   */
  it('asks for the declared window as a maximum the runtime may lower', async () => {
    contextSizes.length = 0

    await ask([{ role: 'user', content: 'hello' }])

    expect(contextSizes).toEqual([{ max: 32_768 }])
  })

  /**
   * `[M]` 46 ms to open the addon here, 0 ms to read. What that buys is a verdict rather than a
   * guess: waiting for someone to speak to the assistant first left every candidate reading
   * `unknown`, and the machine line showing a figure a third of the truth.
   *
   * Reported as it stands, zeroes included — what an empty reading MEANS is the probe's to decide,
   * and deciding it twice is how two answers drift apart.
   */
  it('opens the addon to answer, and reports what it said', async () => {
    await expect(electronLlamaPort().vram()).resolves.toEqual({
      totalBytes: 0,
      freeBytes: 0,
      unifiedBytes: 0,
    })
  })

  it('lets the addon go when the weights are dropped', async () => {
    disposeModel.mockClear()
    disposeLlama.mockClear()
    const port = electronLlamaPort()
    await port.load('/weights/qwen.gguf', { onProgress: () => {} })
    await port.unload()

    expect(disposeModel).toHaveBeenCalledOnce()
    expect(disposeLlama).toHaveBeenCalledOnce()
    expect(port.loaded()).toBeNull()
  })
})
