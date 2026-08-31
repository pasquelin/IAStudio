import { isRecord } from '@shared/guards'
import { TRIPO_BASE_URL } from '@shared/domain/tripo'

/** Narrower than `fetch` on purpose: this is what a test has to answer. */
export type TripoFetch = (input: string, init?: RequestInit) => Promise<Response>

/**
 * What their v3 answers with, measured 2026-08-31 against the live service: a success carries
 * `{"code":0,"status":"success","data":{…}}`, a refusal `{"code":N,"status":"error","message":…,
 * "suggestion":…}` — and the request id travels in the `X-Request-ID` HEADER, not in the body,
 * whatever their reference says.
 */
export class TripoError extends Error {
  constructor(
    /** Their own code — 2 for a bad key, 1004 for a malformed id, 1007 rate, 2000 concurrency. */
    readonly code: number,
    /** The HTTP status, which alone separates a refusal from an outage. */
    readonly httpStatus: number,
    message: string,
    /** What `Retry-After` said, in milliseconds. Absent when the header was not sent. */
    readonly retryAfterMs?: number,
  ) {
    super(message)
    this.name = 'TripoError'
  }
}

/** Their rate limiter. */
const TRIPO_RATE_LIMITED = 1007
/** A category already full — the ceiling `TRIPO_LANE_LIMITS` exists to stay under. */
const TRIPO_TOO_MANY_TASKS = 2000

/**
 * What a retry can fix on their side.
 *
 * The two codes are NOT the same refusal and the studio answers both by waiting: 1007 is their
 * rate limiter, 2000 is a category already full — the ceiling `TRIPO_LANE_LIMITS` exists to stay
 * under, so one arriving means the studio's own count and theirs disagree. Everything else — a
 * bad key, a malformed id, a body they refuse — fails identically forever.
 */
export function isRetryableTripo(error: unknown): boolean {
  if (!(error instanceof TripoError)) return false

  return (
    error.code === TRIPO_RATE_LIMITED ||
    error.code === TRIPO_TOO_MANY_TASKS ||
    error.httpStatus >= 500
  )
}

/** How long they asked to be left alone for, or `null` where they said nothing. */
export function tripoRetryAfterMs(error: unknown): number | null {
  return error instanceof TripoError ? (error.retryAfterMs ?? null) : null
}

/** A task as the studio reads it. Their statuses are kept verbatim — `jobStatusOf` maps them. */
export type TripoTask = {
  taskId: string
  status: string
  /** 0 to 100 on their side. Handed on as it comes: `jobProgressOf` reads both scales. */
  progress?: number
  /** What it has actually cost, once it has. */
  credits?: number
  /** Where the result sits. Signed, and expiring in five minutes — hence the eager download. */
  outputUrl?: string
}

export type TripoApi = {
  /** Creates a task and answers the id it will be followed by. */
  create: (endpoint: string, body: Record<string, unknown>) => Promise<string>
  /** The state of several tasks at once — one request for every generation being watched. */
  status: (taskIds: readonly string[]) => Promise<readonly TripoTask[]>
  /** Sends a file up and answers the token a body names it by. */
  upload: (fileName: string, bytes: Uint8Array, mimeType: string) => Promise<string>
  /** What the key has left, and what its running tasks are holding. */
  balance: () => Promise<{ balance: number; frozen: number }>
}

export type TripoApiOptions = {
  key: () => string | null
  fetch?: TripoFetch
  baseUrl?: string
}

const numberIn = (record: Record<string, unknown>, key: string): number | undefined => {
  const held = record[key]
  return typeof held === 'number' && Number.isFinite(held) ? held : undefined
}

const textIn = (record: Record<string, unknown>, key: string): string | undefined => {
  const held = record[key]
  return typeof held === 'string' && held.length > 0 ? held : undefined
}

/**
 * `Retry-After` in either shape the RFC allows — seconds, or a date. `null` for a header that
 * is neither, which is what keeps a malformed one from becoming a wait of `NaN`.
 */
export function retryAfterMsOf(header: string | null, now: number): number | undefined {
  if (!header) return undefined

  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)

  const at = Date.parse(header)
  return Number.isFinite(at) ? Math.max(0, at - now) : undefined
}

/**
 * The result URL of a finished task, whichever of the two their output carries: a mesh answers
 * `model_url`, a picture `image_url` — and `rendered_image_url` is the preview of a MESH, never
 * its result, so it is read last and only when nothing else answered.
 */
function outputUrlOf(output: unknown): string | undefined {
  if (!isRecord(output)) return undefined

  return (
    textIn(output, 'model_url') ??
    textIn(output, 'image_url') ??
    textIn(output, 'pbr_model') ??
    textIn(output, 'rendered_image_url')
  )
}

export function taskOf(payload: unknown): TripoTask | null {
  if (!isRecord(payload)) return null
  const taskId = textIn(payload, 'task_id') ?? textIn(payload, 'id')
  const status = textIn(payload, 'status')
  if (!taskId || !status) return null

  return {
    taskId,
    status,
    ...(numberIn(payload, 'progress') === undefined
      ? {}
      : { progress: numberIn(payload, 'progress') }),
    ...(numberIn(payload, 'credits_consumed') === undefined
      ? {}
      : { credits: numberIn(payload, 'credits_consumed') }),
    ...(outputUrlOf(payload['output']) === undefined
      ? {}
      : { outputUrl: outputUrlOf(payload['output']) }),
  }
}

/** Their listing answers under one of two names, and neither is measured — both are read. */
function tasksIn(data: unknown): readonly TripoTask[] | null {
  const list = Array.isArray(data) ? data : isRecord(data) ? data['tasks'] : null
  if (!Array.isArray(list)) return null

  return list.flatMap(one => taskOf(one) ?? [])
}

export function createTripoApi({
  key,
  fetch: get = fetch,
  baseUrl = TRIPO_BASE_URL,
}: TripoApiOptions): TripoApi {
  /**
   * Whether `POST /tasks/list` has been seen to work.
   *
   * 🛑 NOT MEASURED: their reference recommends the grouped read and the studio has never run it.
   * Refused once, this drops to one request per task for the rest of the session rather than
   * failing every poll on a shape nobody has verified.
   */
  let grouped = true

  const call = async (
    path: string,
    init?: RequestInit,
    headers?: Record<string, string>,
  ): Promise<unknown> => {
    const held = key()
    if (!held) throw new TripoError(2, 401, 'no Tripo key is held')

    const response = await get(`${baseUrl}/${path}`, {
      ...init,
      headers: { authorization: `Bearer ${held}`, ...headers },
    })

    let body: unknown = null
    try {
      body = await response.json()
    } catch {
      // A gateway answering HTML is the ordinary shape of an outage: the status below says it.
    }

    const code = isRecord(body) ? numberIn(body, 'code') : undefined
    if (response.ok && code === 0) return isRecord(body) ? body['data'] : null

    throw new TripoError(
      code ?? 0,
      response.status,
      (isRecord(body) ? textIn(body, 'message') : undefined) ??
        `${path} answered ${response.status}`,
      retryAfterMsOf(response.headers.get('retry-after'), Date.now()),
    )
  }

  const postJson = (path: string, body: Record<string, unknown>): Promise<unknown> =>
    call(
      path,
      { method: 'POST', body: JSON.stringify(body) },
      { 'content-type': 'application/json' },
    )

  const oneByOne = async (taskIds: readonly string[]): Promise<readonly TripoTask[]> => {
    const read = await Promise.all(taskIds.map(id => call(`tasks/${id}`)))
    return read.flatMap(one => taskOf(one) ?? [])
  }

  return {
    create: async (endpoint, body) => {
      const data = await postJson(endpoint, body)
      const taskId = isRecord(data) ? (textIn(data, 'task_id') ?? textIn(data, 'id')) : undefined
      // Refused rather than answered with an empty id: a task that exists and cannot be followed
      // is a generation paid for and abandoned, which is the one outcome worth throwing over.
      if (!taskId) throw new TripoError(0, 200, 'a task was created without an id to follow it by')

      return taskId
    },

    status: async taskIds => {
      if (taskIds.length === 0) return []
      if (!grouped) return await oneByOne(taskIds)

      try {
        const tasks = tasksIn(await postJson('tasks/list', { task_ids: [...taskIds] }))
        if (tasks) return tasks
      } catch {
        // Nothing to say twice: the fall back below is the answer, and it is taken for good.
      }

      grouped = false
      return await oneByOne(taskIds)
    },

    upload: async (fileName, bytes, mimeType) => {
      const form = new FormData()
      form.append('file', new Blob([bytes], { type: mimeType }), fileName)
      const data = await call('files', { method: 'POST', body: form })
      const token = isRecord(data) ? textIn(data, 'file_token') : undefined
      if (!token) throw new TripoError(0, 200, 'a file was accepted without a token')

      return token
    },

    balance: async () => {
      const data = await call('account/balance')
      if (!isRecord(data)) throw new TripoError(0, 200, 'the balance came back unreadable')

      return { balance: numberIn(data, 'balance') ?? 0, frozen: numberIn(data, 'frozen') ?? 0 }
    },
  }
}
