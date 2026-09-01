import { orElse } from '@shared/promises'
import type { HttpChat } from '@shared/domain/aiCloud'
import { assistantProgress, type AssistantProgress } from '@shared/domain/assistant'
import { linesOf } from '@main/netStream'
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
  /** What the cloud is writing, as it writes it. Present is what asks for a STREAM. */
  readonly onProgress?: (progress: AssistantProgress) => void
}

export type CloudPoster = (input: string, init?: RequestInit) => Promise<Response>

function at(value: unknown, path: readonly string[]): unknown {
  let current: unknown = value
  for (const key of path) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return current
}

function textOf(value: unknown, path: readonly string[]): string | null {
  const leaf = at(value, path)
  return typeof leaf === 'string' && leaf.length > 0 ? leaf : null
}

const numberAt = (value: unknown, path: readonly string[]): number | undefined => {
  const leaf = at(value, path)
  return typeof leaf === 'number' ? leaf : undefined
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

/** What a refused request raises — the size refusals apart, which narrow rather than fail. */
function refusalOf(body: unknown, status: number, label: string): CloudRefused {
  const refusal = `${label} refused: ${textOf(body, ['error', 'message']) ?? `${status}`}`
  return TOO_MUCH.includes(status)
    ? new OversizedRequest(refusal, status)
    : new CloudRefused(refusal, status)
}

async function readBody(
  response: Response,
  pick: (body: unknown) => string | null,
  label: string,
): Promise<string> {
  const body: unknown = await orElse(response.json(), null)
  if (!response.ok) throw refusalOf(body, response.status, label)

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

/** The frames of a `text/event-stream`. Only `data:` lines carry anything the doors below read. */
async function* sseFramesOf(body: ReadableStream<Uint8Array> | null): AsyncIterable<unknown> {
  for await (const line of linesOf(body)) {
    const payload = line.startsWith('data:') ? line.slice(5).trim() : ''
    // `[DONE]` is OpenAI's end marker and is not JSON — parsing it would throw once per answer.
    if (payload === '' || payload === '[DONE]') continue
    try {
      yield JSON.parse(payload)
    } catch {
      // A frame cut by a cancelled read is ordinary.
    }
  }
}

/** What one frame says: text to append, counts, or nothing worth waking a window for. */
type FrameReader = (frame: unknown) => AssistantProgress | null

/** One wire format, whole: how it is asked for, how a frame reads, how a WHOLE body reads. */
type Door = {
  text: (body: unknown) => string | null
  /** 🛑 Anthropic puts the two counts in two DIFFERENT frames, so both paths are read on each. */
  frame: FrameReader
  label: (chat: HttpChat) => string
}

const doorOf = (
  text: (body: unknown) => string | null,
  textIn: readonly string[],
  promptIn: readonly string[],
  replyIn: readonly string[],
  label: (chat: HttpChat) => string,
): Door => ({
  text,
  frame: frame =>
    isRecord(frame)
      ? assistantProgress(
          textOf(frame, textIn) ?? '',
          numberAt(frame, promptIn),
          numberAt(frame, replyIn),
        )
      : null,
  label,
})

const DOORS: Record<HttpChat['kind'], Door> = {
  openai: doorOf(
    openaiText,
    ['choices', '0', 'delta', 'content'],
    ['usage', 'prompt_tokens'],
    ['usage', 'completion_tokens'],
    chat => (chat.kind === 'openai' ? chat.baseUrl : chat.kind),
  ),
  anthropic: doorOf(
    anthropicText,
    ['delta', 'text'],
    ['message', 'usage', 'input_tokens'],
    ['usage', 'output_tokens'],
    () => 'anthropic',
  ),
  gemini: doorOf(
    geminiText,
    ['candidates', '0', 'content', 'parts', '0', 'text'],
    ['usageMetadata', 'promptTokenCount'],
    ['usageMetadata', 'candidatesTokenCount'],
    () => 'gemini',
  ),
}

// 🛑 The status arrives before the first frame, so a briefing too large still narrows here.
async function readStream(
  response: Response,
  door: Door,
  label: string,
  onProgress: (progress: AssistantProgress) => void,
): Promise<string> {
  if (!response.ok) throw refusalOf(await orElse(response.json(), null), response.status, label)

  let written = ''
  for await (const frame of sseFramesOf(response.body)) {
    const progress = door.frame(frame)
    if (progress === null) continue

    written += progress.delta
    onProgress(progress)
  }

  if (written === '') throw new Error(`${label} answered nothing`)
  return written
}

/**
 * The answer, streamed to whoever is watching and read whole for whoever is not.
 *
 * 🛑 The CONTENT TYPE decides, never the request: a gateway free to ignore `stream: true` answers
 * one whole body, which holds no `data:` line — read as a stream it yields nothing, and the turn
 * failed with "answered nothing" on a reply that parses fine.
 */
async function answerFrom(response: Response, ask: CloudChatAsk): Promise<string> {
  const door = DOORS[ask.chat.kind]
  const label = door.label(ask.chat)
  const streaming = response.headers.get('content-type')?.includes('event-stream') === true

  return ask.onProgress && streaming
    ? await readStream(response, door, label, ask.onProgress)
    : await readBody(response, door.text, label)
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
      /**
       * 🛑 `include_usage` or a streamed answer reports NO counts at all — this door puts them in
       * a final frame sent only when asked for. **Blind spot**: `baseUrl` is typed by hand, and a
       * gateway that refuses unknown body fields answers 400, which `TOO_MUCH` reads as a size
       * refusal — so such a door narrows its briefing and pays a second call before failing.
       */
      ...(ask.onProgress ? { stream: true, stream_options: { include_usage: true } } : {}),
    },
    ask.signal,
  )

  return await answerFrom(response, ask)
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
      ...(ask.onProgress ? { stream: true } : {}),
    },
    ask.signal,
  )

  return await answerFrom(response, ask)
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
    // 🛑 This door streams by a different METHOD, not by a field of the body — and `alt=sse` with
    // it, or it answers a JSON array in chunks that no event-stream reader can follow.
    (ask.onProgress ? ':streamGenerateContent' : ':generateContent') +
    `?key=${encodeURIComponent(ask.key)}` +
    (ask.onProgress ? '&alt=sse' : '')
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

  return await answerFrom(response, ask)
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
