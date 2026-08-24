import { orElse } from '@shared/promises'
import type { HttpChat } from '@shared/domain/aiCloud'
import type { AssistantThought } from '@shared/domain/assistant'
import { isRecord } from '@shared/guards'
import type { ChatTurn } from '@main/ai/localRuntimes'
import { log } from '@main/log'
import type { Credentials } from '@main/settings/accounts'
import type { AssistantBrain, NotReady } from './brainPort'
import { answeredTurn, OversizedRequest, turnsWith } from './brainTurn'
import { briefingFor, type Briefing } from './instruction'
import { roomFor } from './promptWindow'

const ASK_TOKENS = 4096

/**
 * The window a chat cloud is taken to hold — an ASSUMPTION, said as one: the model is typed by
 * hand here and none of these clouds publishes its window over the API, so there is nothing to
 * measure. 32 000 tokens is the smallest the eight defaults are believed to have.
 */
const CLOUD_CONTEXT_TOKENS = 32_000

/**
 * And what one that REFUSED that is taken to hold — the narrowest window the studio ships for,
 * which is what an Ollama model declares. Through `roomFor` like the other two doors: the reply
 * and the sentence get their room from the same arithmetic, rather than from a number written
 * here that reserved neither.
 */
const CLOUD_FALLBACK_TOKENS = 4_096

export type HttpBrainDeps = {
  chat: HttpChat
  credentials: () => Credentials | null
  /** Which model of that cloud answers. Read on each turn: it is a setting, and settings change. */
  model: () => string
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
  notReady?: NotReady
}

type Poster = NonNullable<HttpBrainDeps['fetch']>

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

function textOf(value: unknown, path: readonly string[]): string | null {
  let current: unknown = value
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }
  return typeof current === 'string' && current.length > 0 ? current : null
}

function openaiText(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body['choices'])) return null
  return textOf(body['choices'][0], ['message', 'content'])
}

function anthropicText(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body['content'])) return null
  return textOf(body['content'][0], ['text'])
}

function geminiText(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body['candidates'])) return null
  const first: unknown = body['candidates'][0]
  if (
    !isRecord(first) ||
    !isRecord(first['content']) ||
    !Array.isArray(first['content']['parts'])
  ) {
    return null
  }
  return textOf(first['content']['parts'][0], ['text'])
}

/**
 * The statuses that mean "this request was not acceptable as sent" — which, for a briefing of
 * seventy thousand characters against a model typed by hand, is what a window too small looks
 * like. A 401, a 429 or a 500 are NOT among them: they say nothing about the size, and asking
 * again with a shorter one would double a rate limit and hide the real cause.
 */
const TOO_MUCH: readonly number[] = [400, 413, 422]

async function readBody(
  response: Response,
  pick: (body: unknown) => string | null,
  label: string,
): Promise<string> {
  const body: unknown = await orElse(response.json(), null)
  if (!response.ok) {
    const detail = textOf(body, ['error', 'message']) ?? `${response.status}`
    const refusal = `${label} refused: ${detail}`
    throw TOO_MUCH.includes(response.status) ? new OversizedRequest(refusal) : new Error(refusal)
  }
  const text = pick(body)
  if (text === null) throw new Error(`${label} answered nothing`)
  return text
}

function systemOf(messages: readonly ChatTurn[]): string {
  return messages.find(turn => turn.role === 'system')?.content ?? ''
}

function geminiContents(messages: readonly ChatTurn[]): unknown[] {
  return messages
    .filter(turn => turn.role !== 'system')
    .map(turn => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    }))
}

async function postJson(
  post: Poster,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  return await post(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  })
}

async function askOpenAi(
  chat: Extract<HttpChat, { kind: 'openai' }>,
  key: string,
  messages: readonly ChatTurn[],
  post: Poster,
  signal?: AbortSignal,
): Promise<string> {
  const response = await postJson(
    post,
    `${chat.baseUrl.replace(/\/$/, '')}/chat/completions`,
    { authorization: `Bearer ${key}` },
    { model: chat.model, messages, response_format: { type: 'json_object' } },
    signal,
  )
  return await readBody(response, openaiText, chat.baseUrl)
}

async function askAnthropic(
  chat: Extract<HttpChat, { kind: 'anthropic' }>,
  key: string,
  messages: readonly ChatTurn[],
  post: Poster,
  signal?: AbortSignal,
): Promise<string> {
  const response = await postJson(
    post,
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    {
      model: chat.model,
      max_tokens: ASK_TOKENS,
      system: systemOf(messages),
      messages: messages
        .filter(turn => turn.role !== 'system')
        .map(turn => ({
          role: turn.role === 'assistant' ? 'assistant' : 'user',
          content: turn.content,
        })),
    },
    signal,
  )
  return await readBody(response, anthropicText, 'anthropic')
}

async function askGemini(
  chat: Extract<HttpChat, { kind: 'gemini' }>,
  key: string,
  messages: readonly ChatTurn[],
  post: Poster,
  signal?: AbortSignal,
): Promise<string> {
  const system = systemOf(messages)
  const url =
    // Encoded like the key beside it: the model is typed by hand now, and a `#` in it truncated
    // the URL — dropping `?key=` and answering 401 with nothing to read.
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chat.model)}` +
    `:generateContent` +
    `?key=${encodeURIComponent(key)}`
  const response = await postJson(
    post,
    url,
    {},
    {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: geminiContents(messages),
      generationConfig: { responseMimeType: 'application/json' },
    },
    signal,
  )
  return await readBody(response, geminiText, 'gemini')
}

async function ask(
  chat: HttpChat,
  key: string,
  messages: readonly ChatTurn[],
  post: Poster,
  signal?: AbortSignal,
): Promise<string> {
  switch (chat.kind) {
    case 'openai':
      return await askOpenAi(chat, key, messages, post, signal)
    case 'anthropic':
      return await askAnthropic(chat, key, messages, post, signal)
    case 'gemini':
      return await askGemini(chat, key, messages, post, signal)
  }
}

/**
 * A chat cloud reached over HTTP. Same briefing and same JSON parse as the local brain;
 * only the round trip differs, and nothing is billed in studio units.
 */
export function createHttpChatBrain({
  chat,
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
    signal?: AbortSignal,
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
      const answer = await ask(asked, held.key, messages, send, signal)
      if (briefing.narrow === null) narrowed = true
      return { answer, cost: 0 }
    } catch (error) {
      log.warn('assistant', `${chat.kind} thinking failed: ${String(error)}`)
      throw error
    }
  }

  return {
    think: async (request, signal) => {
      // Once this door has refused the whole catalogue and answered the short one, it is asked
      // narrow from the start: the wide briefing is 70 000 characters it would refuse again.
      const briefing = await briefingFor(
        request,
        narrowed ? roomFor(CLOUD_FALLBACK_TOKENS) : roomFor(CLOUD_CONTEXT_TOKENS),
        notReady,
        roomFor(CLOUD_FALLBACK_TOKENS),
      )

      return await answeredTurn(briefing, (shown, complaint) =>
        round(request, shown, signal, complaint),
      )
    },
  }
}
