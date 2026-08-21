import type { ChatHistoryItem, Llama, LlamaModel } from 'node-llama-cpp'
import type { ChatRequest, ChatTurn } from './localRuntimes'
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
type Loaded = { weights: string; contextTokens: number; model: LlamaModel }

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

  const modelFor = async (weights: string, contextTokens: number): Promise<LlamaModel> => {
    if (loaded && loaded.weights === weights) return loaded.model

    // Disposed before the next is read: two sets of weights held at once is what a machine judged
    // able to hold ONE would be asked for, and the second load would be the one that fails.
    await loaded?.model.dispose()
    loaded = null

    const model = await (await require()).loadModel({ modelPath: weights })
    loaded = { weights, contextTokens, model }
    return model
  }

  return {
    ready: () => !refused,

    chat: async (request: ChatRequest, weights: string): Promise<string> => {
      const { LlamaChatSession } = await import('node-llama-cpp')

      let model: LlamaModel
      try {
        model = await modelFor(weights, request.contextTokens)
      } catch (error) {
        // A binary this machine cannot open is an ordinary state, not a crash: the screen says the
        // runtime is not answering, and every later compose reads that without paying for it again.
        refused = true
        throw error
      }

      const context = await model.createContext({ contextSize: request.contextTokens })
      try {
        const session = new LlamaChatSession({
          contextSequence: context.getSequence(),
          // The briefing is a turn of its own on this door, exactly as it is on Ollama's.
          systemPrompt: request.messages.find(turn => turn.role === 'system')?.content,
        })

        session.setChatHistory(request.messages.filter(isSpoken).map(historyItemOf))

        const asked = request.messages.at(-1)
        return await session.prompt(asked?.content ?? '', {
          temperature: 0,
          // A grammar for JSON at large, never the assistant's own shape: a port that knew what
          // `say` and `calls` are would be a port that only one caller could use.
          ...(request.json ? { grammar: await (await require()).getGrammarFor('json') } : {}),
        })
      } finally {
        // The context holds the KV cache, which is the bulk of what a turn takes. The MODEL stays:
        // reloading gigabytes of weights per sentence is what `keep_alive` existed to avoid.
        await context.dispose()
      }
    },
  }
}
