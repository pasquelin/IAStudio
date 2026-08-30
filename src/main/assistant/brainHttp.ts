import type { CloudProviderId, HttpChat } from '@shared/domain/aiCloud'
import type { AssistantThought } from '@shared/domain/assistant'
import { askCloudChat, type CloudPoster } from '@main/ai/cloudChat'
import type { ChatTurn } from '@main/ai/localRuntimes'
import { log } from '@main/log'
import type { Credentials } from '@main/settings/accounts'
import { defined } from '@shared/guards'
import type { AssistantBrain, NotReady, TurnWatch } from './brainPort'
import { answeredTurn, notesFor, turnsWith } from './brainTurn'
import { briefingFor, type Briefing } from './instruction'
import { ASSISTANT_WINDOW_MAX, roomFor } from './promptWindow'

const ASK_TOKENS = 4096

/**
 * The window a chat cloud is taken to hold — an ASSUMPTION, said as one: the model is typed by
 * hand here and none of these clouds publishes its window over the API, so there is nothing to
 * measure. 32 000 tokens is the smallest the eight defaults are believed to have.
 */
const CLOUD_CONTEXT_TOKENS = 32_000

/**
 * And what one that REFUSED that is taken to hold — `ASSISTANT_WINDOW_MAX`, the window the short
 * briefing is composed against everywhere else. Through `roomFor` like the other two doors: the
 * reply and the sentence get their room from the same arithmetic, rather than from a number
 * written here that reserved neither.
 *
 * 🛑 `[M]` It was 4 096 — an Ollama TAG's figure, on a door no Ollama model reaches — leaving the
 * briefing 7 116 characters against a catalogue costing 7 098: eighteen of margin, and the folders
 * block dropped whole. No chat cloud here holds under 8 192.
 */
const CLOUD_FALLBACK_TOKENS = ASSISTANT_WINDOW_MAX

export type HttpBrainDeps = {
  chat: HttpChat
  /** The provider — see the `sent` note, which says why it is not `chat.kind`. */
  cloud: CloudProviderId
  credentials: () => Credentials | null
  /** Which model of that cloud answers. Read on each turn: it is a setting, and settings change. */
  model: () => string
  fetch?: CloudPoster
  notReady?: NotReady
}

function messagesFor(
  briefing: string,
  history: readonly string[],
  utterance: string,
): readonly ChatTurn[] {
  // One user turn: Anthropic (and Gemini) refuse two user messages in a row, and the history
  // arrives already rendered as lines rather than as alternating roles.
  const prior = history.length > 0 ? `${history.join('\n\n')}\n\n` : ''
  return [
    { role: 'system', content: briefing },
    { role: 'user', content: prior + utterance },
  ]
}

/**
 * A chat cloud reached over HTTP. Same briefing and same JSON parse as the local brain;
 * only the round trip differs, and nothing is billed in studio units.
 */
export function createHttpChatBrain({
  chat,
  cloud,
  credentials,
  model,
  fetch: post,
  notReady,
}: HttpBrainDeps): AssistantBrain {
  const send = post ?? fetch
  /**
   * Whether this door has already refused the whole catalogue AND answered the short one. Both
   * halves matter: a 400 for a model name nobody knows refuses either briefing, and would
   * otherwise narrow this door for the life of the process on a fault that is not about size.
   */
  let narrowed = false

  const round = async (
    request: AssistantThought,
    briefing: Briefing,
    watch: TurnWatch,
    complaint?: string,
  ) => {
    const held = credentials()
    if (held === null) throw new Error(`${chat.kind} has no key`)

    // The sentence arrives whole: the channel already bounds it, and what used to cut it here was
    // Scenario's ten thousand characters — a ceiling none of these clouds has.
    const messages = messagesFor(
      briefing.text,
      turnsWith(request.history, complaint),
      request.utterance,
    )

    try {
      // The model is settled HERE and nowhere deeper: what a cloud is talked to with is a
      // setting, and the three request shapes below only ever read the one they were handed.
      const asked = { ...chat, model: model() }
      const answer = await askCloudChat(
        {
          chat: asked,
          key: held.key,
          messages,
          json: true,
          maxTokens: ASK_TOKENS,
          ...defined({ signal: watch.signal, onProgress: watch.onProgress }),
        },
        send,
      )
      if (briefing.narrow === null) narrowed = true
      return { answer, cost: 0 }
    } catch (error) {
      log.warn('assistant', `${chat.kind} thinking failed: ${String(error)}`)
      throw error
    }
  }

  return {
    // 🛑 None, and INVENTING one is the defect this says no to: neither figure below is a window,
    // both are briefing budgets, and one worn as a window is the `2 067 / 4 096` shown for
    // DeepSeek. No chat cloud here publishes its window over the API, so there is nothing to read.
    window: () => Promise.resolve(null),
    think: async (request, watch = {}) => {
      // Once this door has refused the whole catalogue and answered the short one, it is asked
      // narrow from the start: the wide briefing is 70 000 characters it would refuse again.
      const briefing = await briefingFor(
        request,
        narrowed ? roomFor(CLOUD_FALLBACK_TOKENS) : roomFor(CLOUD_CONTEXT_TOKENS),
        notReady,
        roomFor(CLOUD_FALLBACK_TOKENS),
      )

      // 🛑 No window travels with these frames: the composer shows the count ALONE, as it does
      // for Scenario. Both figures above are assumptions — `2 067 / 4 096` was shown for DeepSeek,
      // whose window is far larger, off a number that only ever budgeted the briefing.
      return await answeredTurn(
        briefing,
        (shown, complaint) => round(request, shown, watch, complaint),
        watch.onProgress,
        notesFor(cloud, model(), watch),
      )
    },
  }
}
