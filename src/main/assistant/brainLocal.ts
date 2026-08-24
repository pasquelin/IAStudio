import type { AssistantThought } from '@shared/domain/assistant'
import { log } from '@main/log'
import type { ChatRequest, ChatTurn } from '@main/ai/localRuntimes'
import type { AssistantBrain, NotReady } from './brainPort'
import { retriedAnswer, turnsWith } from './brainRetry'
import { studioBriefing, utteranceWithin } from './instruction'
import { promptWindow } from './promptWindow'

/**
 * The assistant's thinking, run on a model on this machine. Same catalogue and same parsing as the
 * cloud brain; only the round trip differs, and nothing was billed.
 */

export type LocalBrainDeps = {
  /** The one round trip. Hands back the model's raw text, which `parseReply` reads. */
  chat: (request: ChatRequest) => Promise<string>
  /** Which model answers. Fixed here, because the router settles the choice on every turn. */
  modelId: string
  /** Its window. Required, so a model that declares none cannot reach this at all. */
  contextTokens: number
  notReady?: NotReady
}

/**
 * 🛑 The sentence just typed is the LAST turn, and that is the whole difference with the cloud
 * door: there the instruction is a field beside the inputs, here it is one turn among others, and
 * a chat model answers the last one. Burying it in the `system` turn had the model reply to the
 * turn before it.
 */
function messagesFor(
  briefing: string,
  history: readonly string[],
  utterance: string,
): readonly ChatTurn[] {
  return [
    { role: 'system', content: briefing },
    ...history.map((content): ChatTurn => ({ role: 'user', content })),
    { role: 'user', content: utterance },
  ]
}

export function createLocalBrain({
  chat,
  modelId,
  contextTokens,
  notReady,
}: LocalBrainDeps): AssistantBrain {
  const ask = async (
    request: AssistantThought,
    briefing: string,
    signal?: AbortSignal,
    complaint?: string,
  ) => {
    const said = utteranceWithin(request.utterance, briefing.length)
    // Raising the window here would quietly ask for memory nothing budgeted: the reservation was
    // measured against the one the manifest declares. The briefing and the sentence are what must
    // survive, so the history is what gives ground — the runtime would cut the briefing first.
    const window = promptWindow(
      briefing + said,
      turnsWith(request.history, complaint),
      contextTokens,
    )
    if (window.overrun) {
      log.warn('assistant', `the briefing alone overruns ${modelId}: the runtime will cut it`)
    }

    return {
      answer: await chat({
        model: modelId,
        messages: messagesFor(briefing, window.history, said),
        contextTokens,
        json: true,
        ...(signal ? { signal } : {}),
      }),
      cost: 0,
    }
  }

  return {
    think: async (request, signal) => {
      // Read once, outside the retry, as `model()` is next door: a complaint quotes an answer, and
      // a second reading would ship a briefing the complaint was not about.
      const briefing = studioBriefing(await notReady?.())
      return await retriedAnswer(complaint => ask(request, briefing, signal, complaint))
    },
  }
}
