import { isRecord, readNumber, readString } from '@shared/guards'
import { PROGRESS_STEP } from '@shared/domain/taskProgress'
import type { ChatRequest, LocalRuntime } from './localRuntimes'

/**
 * Ollama on its NATIVE door — `/api/chat` and not `/v1/chat/completions`: the same server honours
 * `keep_alive` and `options.num_ctx` here and ignores both there. That is the whole of ADR-18.
 */

/** A readiness probe has no reason to wait longer than a loopback round trip. */
const PROBE_TIMEOUT_MS = 1_500

/** A command either happens or it does not; nothing here is a generation. */
const COMMAND_TIMEOUT_MS = 10_000

/**
 * The ceiling on one answer. `[M]` A short reply on `llama3.2:3b` took 3.8 s cold on an M2 Max, so
 * this is two orders of magnitude of room — it is there for a server that never answers at all,
 * not to cut a long answer short.
 */
const ANSWER_TIMEOUT_MS = 10 * 60 * 1_000

/**
 * 🛑 `keep_alive` is deliberately NOT sent, where a first draft pinned it at `-1`.
 *
 * `[M]` It pins 8.2 GB for as long as the server lives — measured against ADR-18 — and nothing in
 * this studio can unload them: `admissionFor` has no production caller, so quitting the app left
 * the memory taken until Ollama itself was restarted. Worse, `freemem()` falls by that much, the
 * next turn reads the machine as too small for the very model answering it, and the conversation
 * moves to a BILLED cloud without a word. Ollama's own idle timer costs a ~1.8 s reload after a
 * pause and gives the memory back.
 */

export type OllamaReply = {
  ok: boolean
  status: number
  /** The body as it arrives. Whole lines are not promised — `linesOf` is what makes them. */
  chunks: AsyncIterable<string>
}

/** The network, injected: everything above it is testable without a server. */
export type OllamaPort = {
  send: (
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ) => Promise<OllamaReply>
}

export type OllamaClient = {
  /** The tags the server holds. THROWS when it does not answer — that is how "down" is reported. */
  installedNames: () => Promise<readonly string[]>
  /** Bytes received across every layer, against a total only the manifest knows. */
  pull: (name: string, onReceived: (bytes: number) => void, signal: AbortSignal) => Promise<void>
  remove: (name: string) => Promise<void>
  chat: (request: ChatRequest, signal?: AbortSignal) => Promise<string>
}

/**
 * Whole NDJSON lines out of chunks cut wherever the socket happened to cut them. A boundary lands
 * mid-object often enough to matter, and never where a test would happen to put it.
 */
export async function* linesOf(chunks: AsyncIterable<string>): AsyncIterable<string> {
  let held = ''

  for await (const chunk of chunks) {
    held += chunk
    const parts = held.split('\n')
    held = parts.pop() ?? ''
    for (const part of parts) if (part.trim() !== '') yield part
  }

  if (held.trim() !== '') yield held
}

/** One NDJSON line, or nothing for a line that is not an object — a proxy's error page is one. */
function rowOf(line: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(line)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * A whole answer read into memory, bounded. Nothing on this door answers in megabytes — and the
 * bound is what keeps a stranger listening on 11434 from streaming an error page into the main
 * process without end.
 */
const BODY_MAX = 1024 * 1024

async function jsonBody(reply: OllamaReply, what: string): Promise<Record<string, unknown>> {
  let body = ''
  for await (const chunk of reply.chunks) {
    body += chunk
    if (body.length > BODY_MAX) throw new Error(`${what} answered more than ${BODY_MAX} characters`)
  }
  if (!reply.ok) throw new Error(`${what} refused: HTTP ${reply.status}`)

  const row = rowOf(body)
  if (row === null) throw new Error(`${what} answered something that is not JSON`)

  const refusal = readString(row, 'error', '')
  if (refusal !== '') throw new Error(`${what} refused: ${refusal}`)

  return row
}

export function createOllamaClient(port: OllamaPort): OllamaClient {
  return {
    installedNames: async () => {
      // Bounded, unlike the chat below: this sits on every compose, so on every assistant turn,
      // and a server that accepts the socket without answering would hang the turn silently.
      const answered = await port.send(
        'GET',
        '/api/tags',
        undefined,
        AbortSignal.timeout(PROBE_TIMEOUT_MS),
      )
      const listed = (await jsonBody(answered, 'tags')).models
      if (!Array.isArray(listed)) return []

      return listed
        .filter(isRecord)
        .map(entry => readString(entry, 'name', ''))
        .filter(name => name !== '')
    },

    /**
     * 🛑 `[M]` A pull that fails answers **HTTP 200** with `{"error": …}` in the stream, measured
     * 2026-08-21 on an unknown tag. The stream is the verdict, never the status code: only a
     * `success` line means the weights arrived.
     */
    pull: async (name, onReceived, signal) => {
      const reply = await port.send('POST', '/api/pull', { model: name, stream: true }, signal)
      if (!reply.ok) throw new Error(`pull refused: HTTP ${reply.status}`)

      // Per DIGEST, because `total` is a layer's and not the model's: summing the lines would
      // count the same bytes again on every report.
      const received = new Map<string, number>()
      let arrived = false

      for await (const line of linesOf(reply.chunks)) {
        const row = rowOf(line)
        if (row === null) continue

        const refusal = readString(row, 'error', '')
        if (refusal !== '') throw new Error(`pull refused: ${refusal}`)
        if (row.status === 'success') arrived = true

        const digest = readString(row, 'digest', '')
        if (digest !== '') {
          received.set(digest, readNumber(row, 'completed', 0))
          onReceived([...received.values()].reduce((total, bytes) => total + bytes, 0))
        }
      }

      if (!arrived) throw new Error(`pull of ${name} ended without success`)
    },

    /**
     * 🛑 The STATUS is the verdict here, where the stream is the verdict for a pull: `/api/delete`
     * answers 200 with an EMPTY body, so reading it as JSON made every successful removal report a
     * failure — the weights gone, the row still saying "installed", and the window handed an error.
     */
    remove: async name => {
      const reply = await port.send(
        'DELETE',
        '/api/delete',
        { model: name },
        AbortSignal.timeout(COMMAND_TIMEOUT_MS),
      )
      // Drained rather than abandoned: a body left unread holds the connection open until the
      // collector runs, and a refusal says why in it.
      let body = ''
      for await (const chunk of reply.chunks) body += chunk.slice(0, BODY_MAX)

      if (!reply.ok) throw new Error(`delete refused: HTTP ${reply.status} ${body.slice(0, 200)}`)
    },

    /**
     * No deadline of its own, where `installedNames` has one: a local inference legitimately runs
     * for minutes. The ceiling is generous rather than absent — a server that accepts the socket
     * and never answers would otherwise leave the assistant spinning with no way out.
     */
    chat: async (request, signal) => {
      const answered = await jsonBody(
        await port.send(
          'POST',
          '/api/chat',
          {
            model: request.model,
            messages: request.messages,
            stream: false,
            ...(request.json ? { format: 'json' } : {}),
            options: { num_ctx: request.contextTokens, temperature: 0 },
          },
          signal ?? AbortSignal.timeout(ANSWER_TIMEOUT_MS),
        ),
        'chat',
      )

      const message = answered.message
      return isRecord(message) ? readString(message, 'content', '') : ''
    },
  }
}

/**
 * Ollama as a runtime of this studio: it installs its own weights and it converses.
 *
 * `model.id` IS the tag the server knows — `llama3.2:3b` — rather than a second field only this
 * loader would fill. The bar is drawn against the manifest's `diskBytes`, the stream reporting one
 * total per LAYER and never the model's.
 */
export function ollamaLocalRuntime(client: OllamaClient): LocalRuntime {
  return {
    read: async models => {
      const names = new Set(await client.installedNames())
      return {
        ready: true,
        installed: new Set(models.filter(model => names.has(model.id)).map(model => model.id)),
      }
    },

    /**
     * Throttled at the same step the file downloads use, and for the same reason — except that
     * Ollama reports on a ~60 ms ticker rather than per byte, so a SLOW network would broadcast
     * MORE: 6 700 overviews to every window at 5 MB/s, against 482 here whatever the speed.
     *
     * The total is `max(received, diskBytes)` because the manifest DECLARES a size where the
     * stream measures one: a mutable tag re-pushed a little heavier would otherwise pin the bar at
     * 100 % while bytes kept arriving. And the last word is said once the stream has ENDED, never
     * on `received >= total`, which is a declaration rather than an ending.
     */
    install: async (model, onProgress, signal) => {
      let reported = 0
      let received = 0
      const say = (bytes: number): void =>
        onProgress({ received: bytes, total: Math.max(bytes, model.diskBytes) })

      await client.pull(
        model.id,
        bytes => {
          received = bytes
          if (bytes - reported < PROGRESS_STEP) return

          reported = bytes
          say(bytes)
        },
        signal,
      )

      if (received !== reported) say(received)
    },

    remove: model => client.remove(model.id),

    chat: request => client.chat(request),
  }
}
