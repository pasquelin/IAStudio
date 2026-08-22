import type { ChatHistoryItem, Llama, LlamaGrammar, LlamaModel } from 'node-llama-cpp'
import type { ChatRequest, ChatTurn, LoadOptions } from './localRuntimes'
import type { LlamaPort } from './llamaRuntime'

/**
 * llama.cpp in this process — the addon ships a prebuilt binary per platform, Metal on Apple
 * Silicon and CUDA or Vulkan elsewhere, so nothing is compiled here and nothing is installed by
 * the person.
 *
 * 🛑 Imported LAZILY, and that is not an optimisation: loading the addon opens the GPU, and doing
 * it at boot would delay the first window for a session that may never say a word to the assistant.
 */

/** One model held at a time: a second would take the memory of the first without freeing it. */
type Loaded = { weights: string; model: LlamaModel }

async function openLlama(): Promise<Llama> {
  const { getLlama } = await import('node-llama-cpp')
  return await getLlama()
}

/** The briefing rides in `systemPrompt`; the history is what was actually said on either side. */
const isSpoken = (turn: ChatTurn): boolean => turn.role !== 'system'

function historyItemOf(turn: ChatTurn): ChatHistoryItem {
  if (turn.role === 'user') return { type: 'user', text: turn.content }
  return { type: 'model', response: [turn.content] }
}

export function electronLlamaPort(): LlamaPort {
  let llama: Llama | null = null
  let loaded: Loaded | null = null
  // Remembered rather than retried: a machine with no usable binary answers the same way every
  // time, and asking again on every compose would open the GPU once per assistant turn.
  let refused = false

  const require = async (): Promise<Llama> => {
    llama ??= await openLlama()
    return llama
  }

  /** Built once: it depends on nothing of a request, and every assistant turn asks for JSON. */
  let json: Promise<LlamaGrammar> | null = null

  const jsonGrammar = async (): Promise<LlamaGrammar> => {
    json ??= (await require()).getGrammarFor('json')
    return await json
  }

  const release = async (): Promise<void> => {
    try {
      // Disposed before the next is read: two sets of weights held at once is what a machine
      // judged able to hold ONE would be asked for, and the second load fails.
      await loaded?.model.dispose()
    } finally {
      loaded = null
    }
    // The typings we ship omit `dispose`; the addon still exposes it and it is what frees Metal.
    const addon = llama as { dispose?: () => Promise<void> } | null
    llama = null
    json = null
    try {
      await addon?.dispose?.()
    } catch {
      // The weights are already gone; a failed addon dispose must not block the next load.
    }
  }

  const hold = async (weights: string, options: LoadOptions): Promise<LlamaModel> => {
    if (loaded && loaded.weights === weights) return loaded.model
    await release()

    try {
      const model = await (
        await require()
      ).loadModel({
        modelPath: weights,
        onLoadProgress: options.onProgress,
        ...(options.signal ? { loadSignal: options.signal } : {}),
      })

      loaded = { weights, model }
      return model
    } catch (error) {
      // The ADDON failing to open is an ordinary state on a machine nobody built for, and every
      // later compose reads it without paying for it again. A load the machine refused is not
      // that, and neither is an abort: both leave the addon perfectly usable, and `llama` set.
      refused = llama === null
      throw error
    }
  }

  return {
    ready: () => !refused,

    loaded: () => loaded?.weights ?? null,

    load: async (weights, options) => (await hold(weights, options)).size,

    unload: release,

    /**
     * `[M]` 46 ms to open the addon on this machine, 0 ms to read — paid once per process, and
     * what it buys is a verdict instead of a guess: without it every candidate reads `unknown`
     * until somebody has spoken to the assistant.
     */
    vram: async () => {
      if (refused) return null

      try {
        const state = await (await require()).getVramState()
        // Reported as it stands, zeroes included: what an empty reading MEANS is the probe's to
        // decide, and deciding it twice is how the two answers drift.
        return { totalBytes: state.total, freeBytes: state.free, unifiedBytes: state.unifiedSize }
      } catch {
        // A machine nobody built a binary for. Remembered, or every compose reopens the same
        // failure — and answered as an absence, which is what the probe falls back from.
        refused = true
        return null
      }
    },

    chat: async (request: ChatRequest, weights: string): Promise<string> => {
      const { LlamaChatSession } = await import('node-llama-cpp')

      const model = await hold(weights, { onProgress: () => {} })

      // A CEILING, not a demand: a manifest may declare the window the weights were trained for —
      // 131 072 tokens on a recent Llama — and asking for it outright allocates an attention cache
      // of many gigabytes, which fails on every turn. `max` lets the runtime take what it can.
      const context = await model.createContext({ contextSize: { max: request.contextTokens } })
      try {
        const briefing = request.messages.find(turn => turn.role === 'system')?.content
        const session = new LlamaChatSession({
          contextSequence: context.getSequence(),
          // The briefing is a turn of its own on this door, exactly as it is on Ollama's.
          systemPrompt: briefing,
        })

        // 🛑 Everything BUT the last turn, and the briefing put back at the head. `setChatHistory`
        // REPLACES what the constructor seeded, so passing the spoken turns alone dropped the
        // briefing entirely; and leaving the last user turn in made `prompt` merge it with itself,
        // sending the sentence twice.
        const spoken = request.messages.filter(isSpoken)
        const earlier = spoken.slice(0, -1).map(historyItemOf)
        if (earlier.length > 0) {
          const head: ChatHistoryItem[] =
            briefing === undefined ? [] : [{ type: 'system', text: briefing }]
          session.setChatHistory([...head, ...earlier])
        }

        return await session.prompt(spoken.at(-1)?.content ?? '', {
          temperature: 0,
          ...(request.signal ? { signal: request.signal } : {}),
          // A grammar for JSON at large, never the assistant's own shape: a port that knew what
          // `say` and `calls` are would be a port that only one caller could use.
          ...(request.json ? { grammar: await jsonGrammar() } : {}),
        })
      } finally {
        // The context holds the KV cache, which is the bulk of what a turn takes. The MODEL stays:
        // reloading gigabytes of weights per sentence is what `keep_alive` existed to avoid.
        await context.dispose()
      }
    },
  }
}
