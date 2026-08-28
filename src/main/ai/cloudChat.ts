import { orElse } from '@shared/promises'
import type { HttpChat } from '@shared/domain/aiCloud'
import { isRecord } from '@shared/guards'
import type { ChatTurn } from './localRuntimes'

/**
 * One round trip against a chat cloud — the door the assistant thinks through and the one a
 * script is written by. The three shapes below are the clouds' own wire formats.
 */

/** What a cloud answered other than 200, with the status — the one thing safe to keep of it. */
export class CloudRefused extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

/** A door that refused the request for its SIZE — for a chat cloud, a 400, 413 or 422. */
export class OversizedRequest extends CloudRefused {}

export type CloudChatAsk = {
  readonly chat: HttpChat
  readonly key: string
  readonly messages: readonly ChatTurn[]
  /** Whether the answer must be one JSON object. Stated by the caller: nothing here guesses. */
  readonly json: boolean
  readonly maxTokens: number
  /** How loose the answer may be. Left out where the form says nothing: each cloud has its own. */
  readonly temperature?: number
  /** The nucleus. Honoured by all three wire formats, unlike a seed — see `SEED_FIELD_KEY`. */
  readonly topP?: number
  readonly signal?: AbortSignal
}

export type CloudPoster = (input: string, init?: RequestInit) => Promise<Response>

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
    throw TOO_MUCH.includes(response.status)
      ? new OversizedRequest(refusal, response.status)
      : new CloudRefused(refusal, response.status)
  }
  const text = pick(body)
  if (text === null) throw new Error(`${label} answered nothing`)
  return text
}

function systemOf(messages: readonly ChatTurn[]): string {
  return messages.find(turn => turn.role === 'system')?.content ?? ''
}

/** The system turn travels in a field of its own on both doors that take one. */
function withoutSystem(messages: readonly ChatTurn[]): readonly ChatTurn[] {
  return messages.filter(turn => turn.role !== 'system')
}

function geminiContents(messages: readonly ChatTurn[]): unknown[] {
  return withoutSystem(messages).map(turn => ({
    role: turn.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: turn.content }],
  }))
}

async function postJson(
  post: CloudPoster,
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

/** The knobs a form filled, under the names one wire format gives them. Absent ones stay absent. */
function sampling(ask: CloudChatAsk, topP: 'top_p' | 'topP'): Record<string, number> {
  return {
    ...(ask.temperature === undefined ? {} : { temperature: ask.temperature }),
    ...(ask.topP === undefined ? {} : { [topP]: ask.topP }),
  }
}

async function askOpenAi(
  chat: Extract<HttpChat, { kind: 'openai' }>,
  ask: CloudChatAsk,
  post: CloudPoster,
): Promise<string> {
  const response = await postJson(
    post,
    `${chat.baseUrl.replace(/\/$/, '')}/chat/completions`,
    { authorization: `Bearer ${ask.key}` },
    {
      model: chat.model,
      messages: ask.messages,
      max_tokens: ask.maxTokens,
      ...sampling(ask, 'top_p'),
      ...(ask.json ? { response_format: { type: 'json_object' } } : {}),
    },
    ask.signal,
  )
  return await readBody(response, openaiText, chat.baseUrl)
}

async function askAnthropic(
  chat: Extract<HttpChat, { kind: 'anthropic' }>,
  ask: CloudChatAsk,
  post: CloudPoster,
): Promise<string> {
  const response = await postJson(
    post,
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': ask.key, 'anthropic-version': '2023-06-01' },
    {
      model: chat.model,
      max_tokens: ask.maxTokens,
      ...sampling(ask, 'top_p'),
      system: systemOf(ask.messages),
      messages: withoutSystem(ask.messages).map(turn => ({
        role: turn.role === 'assistant' ? 'assistant' : 'user',
        content: turn.content,
      })),
    },
    ask.signal,
  )
  return await readBody(response, anthropicText, 'anthropic')
}

async function askGemini(
  chat: Extract<HttpChat, { kind: 'gemini' }>,
  ask: CloudChatAsk,
  post: CloudPoster,
): Promise<string> {
  const system = systemOf(ask.messages)
  const url =
    // Encoded like the key beside it: the model is typed by hand now, and a `#` in it truncated
    // the URL — dropping `?key=` and answering 401 with nothing to read.
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chat.model)}` +
    `:generateContent` +
    `?key=${encodeURIComponent(ask.key)}`
  const response = await postJson(
    post,
    url,
    {},
    {
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: geminiContents(ask.messages),
      generationConfig: {
        maxOutputTokens: ask.maxTokens,
        ...sampling(ask, 'topP'),
        ...(ask.json ? { responseMimeType: 'application/json' } : {}),
      },
    },
    ask.signal,
  )
  return await readBody(response, geminiText, 'gemini')
}

/** Asks the cloud its own way, and answers the text it sent back. */
export async function askCloudChat(ask: CloudChatAsk, post: CloudPoster): Promise<string> {
  switch (ask.chat.kind) {
    case 'openai':
      return await askOpenAi(ask.chat, ask, post)
    case 'anthropic':
      return await askAnthropic(ask.chat, ask, post)
    case 'gemini':
      return await askGemini(ask.chat, ask, post)
  }
}
