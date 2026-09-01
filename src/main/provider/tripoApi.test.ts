import { describe, expect, it, vi } from 'vitest'
import {
  createTripoApi,
  isRetryableTripo,
  retryAfterMsOf,
  taskOf,
  TripoError,
  tripoRetryAfterMs,
  type TripoFetch,
} from './tripoApi'

const answer = (body: unknown, init?: { status?: number; headers?: Record<string, string> }) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })

const ok = (data: unknown) => answer({ code: 0, status: 'success', data })

const apiOn = (get: TripoFetch, key: string | null = 'k') =>
  createTripoApi({ key: () => key, fetch: get, baseUrl: 'https://tripo.test/v3' })

describe('the Tripo API', () => {
  it('creates a task on the endpoint an entry names, and answers its id', async () => {
    const get = vi.fn<TripoFetch>().mockResolvedValue(ok({ task_id: 'ab-12' }))

    expect(await apiOn(get).create('generation/text-to-model', { prompt: 'a hat' })).toBe('ab-12')

    const [url, init] = get.mock.calls[0] ?? []
    expect(url).toBe('https://tripo.test/v3/generation/text-to-model')
    expect(init?.body).toBe('{"prompt":"a hat"}')
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer k')
  })

  it('refuses before the wire when no key is held', async () => {
    const get = vi.fn<TripoFetch>()

    await expect(apiOn(get, null).balance()).rejects.toBeInstanceOf(TripoError)
    expect(get).not.toHaveBeenCalled()
  })

  /** Their own code, not the HTTP one: 1007 is a rate limit and 2000 a full category. */
  it('carries their code, the status and what Retry-After asked for', async () => {
    const get = vi
      .fn<TripoFetch>()
      .mockResolvedValue(
        answer(
          { code: 2000, status: 'error', message: 'too many tasks' },
          { status: 429, headers: { 'retry-after': '3' } },
        ),
      )

    await expect(apiOn(get).create('generation/text-to-model', {})).rejects.toMatchObject({
      code: 2000,
      httpStatus: 429,
      retryAfterMs: 3000,
    })
  })

  // A 200 whose body says `code` is not zero is a refusal too — the envelope decides, not HTTP.
  it('reads a refusal wearing a 200', async () => {
    const get = vi
      .fn<TripoFetch>()
      .mockResolvedValue(answer({ code: 1004, status: 'error', message: 'expected UUID format' }))

    await expect(apiOn(get).create('tasks/x', {})).rejects.toMatchObject({ code: 1004 })
  })

  it('asks about every watched task in one request', async () => {
    const get = vi.fn<TripoFetch>().mockResolvedValue(
      ok({
        tasks: [
          { task_id: 'a', status: 'running', progress: 40 },
          { task_id: 'b', status: 'success', output: { model_url: 'https://x/b.glb' } },
        ],
      }),
    )

    const tasks = await apiOn(get).status(['a', 'b'])

    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0]?.[0]).toBe('https://tripo.test/v3/tasks/list')
    // A FRACTION: theirs is a percentage, and the manager only reads the larger scale above 2.
    expect(tasks).toEqual([
      { taskId: 'a', status: 'running', progress: 0.4, outputUrls: {} },
      { taskId: 'b', status: 'success', outputUrls: { model_url: 'https://x/b.glb' } },
    ])
  })

  /**
   * The grouped read is the ONE thing here nobody has measured. Refused, the studio drops to one
   * request per task rather than failing every poll on a shape that was only ever documented.
   */
  it('falls back to one request per task when the grouped read is not served, and stays there', async () => {
    const get = vi
      .fn<TripoFetch>()
      .mockImplementationOnce(() =>
        Promise.resolve(answer({ code: 1000, status: 'error', message: 'no' }, { status: 404 })),
      )
      .mockImplementation(() => Promise.resolve(ok({ task_id: 'a', status: 'queued' })))

    const api = apiOn(get)
    expect(await api.status(['a'])).toEqual([{ taskId: 'a', status: 'queued', outputUrls: {} }])
    expect(await api.status(['a'])).toEqual([{ taskId: 'a', status: 'queued', outputUrls: {} }])

    expect(get.mock.calls.map(call => call[0])).toEqual([
      'https://tripo.test/v3/tasks/list',
      'https://tripo.test/v3/tasks/a',
      'https://tripo.test/v3/tasks/a',
    ])
  })

  it('answers nothing for an empty watch list rather than asking', async () => {
    const get = vi.fn<TripoFetch>()

    expect(await apiOn(get).status([])).toEqual([])
    expect(get).not.toHaveBeenCalled()
  })

  it('sends a file up and answers the token a body names it by', async () => {
    const get = vi.fn<TripoFetch>().mockResolvedValue(ok({ file_token: 'tok-1' }))

    expect(await apiOn(get).upload('hat.png', new Uint8Array([1, 2]), 'image/png')).toBe('tok-1')
    expect(get.mock.calls[0]?.[1]?.body).toBeInstanceOf(FormData)
  })

  it('reads what the key has left and what its running tasks hold', async () => {
    const get = vi.fn<TripoFetch>().mockResolvedValue(ok({ balance: 5000, frozen: 20 }))

    expect(await apiOn(get).balance()).toEqual({ balance: 5000, frozen: 20 })
  })
})

describe('taskOf', () => {
  /**
   * 🛑 Handed over WHOLE: measured, a text-to-model answers `model_url`, `rendered_image_url` AND
   * `generated_image_url` — the last two being the picture it drew on the way. Reducing to one
   * here would file a mesh's intermediate picture as the mesh.
   */
  it('carries every URL the output names, and nothing that is not one', () => {
    const task = taskOf({
      task_id: 'a',
      status: 'success',
      output: { model_url: 'https://m', rendered_image_url: 'https://r', part_names: ['a'] },
    })

    expect(task?.outputUrls).toEqual({ model_url: 'https://m', rendered_image_url: 'https://r' })
  })

  it('drops a payload naming neither a task nor a state', () => {
    expect(taskOf({ status: 'success' })).toBeNull()
    expect(taskOf('running')).toBeNull()
  })
})

describe('retryAfterMsOf', () => {
  it('reads the two shapes the header may take, and refuses a third', () => {
    expect(retryAfterMsOf('3', 0)).toBe(3000)
    expect(retryAfterMsOf(new Date(10_000).toUTCString(), 4000)).toBe(6000)
    expect(retryAfterMsOf('soon', 0)).toBeUndefined()
    expect(retryAfterMsOf(null, 0)).toBeUndefined()
  })

  // A window that already closed is a wait of zero, never a negative one a sleep would ignore.
  it('never asks for a wait in the past', () => {
    expect(retryAfterMsOf(new Date(1000).toUTCString(), 9000)).toBe(0)
  })
})

/**
 * The two refusals a wait can fix, and they are not the same thing: 1007 is their rate limiter,
 * 2000 a category already full — the ceiling the studio holds its own count against.
 */
describe('what a retry can fix on their side', () => {
  const failing = (code: number, httpStatus = 429, retryAfterMs?: number) =>
    new TripoError(code, httpStatus, 'no', retryAfterMs)

  it('waits out their rate limit, their full category and an outage', () => {
    expect(isRetryableTripo(failing(1007))).toBe(true)
    expect(isRetryableTripo(failing(2000))).toBe(true)
    expect(isRetryableTripo(failing(0, 503))).toBe(true)
  })

  it('gives up on what asking again cannot change', () => {
    expect(isRetryableTripo(failing(2, 401))).toBe(false)
    expect(isRetryableTripo(failing(1004, 400))).toBe(false)
    expect(isRetryableTripo(new Error('something else'))).toBe(false)
  })

  it('hands on the wait they asked for, and nothing where they said nothing', () => {
    expect(tripoRetryAfterMs(failing(2000, 429, 3000))).toBe(3000)
    expect(tripoRetryAfterMs(failing(2000))).toBeNull()
    expect(tripoRetryAfterMs(new Error('elsewhere'))).toBeNull()
  })
})

/**
 * 🛑 The grouped read is demoted on a shape nobody serves, NEVER on a refusal: read as "not
 * served", one rate limit would spend a request per task for the rest of the session — against
 * the very limiter it exists to stay under.
 */
describe('what demotes the grouped read', () => {
  it('keeps asking together after a refusal that says nothing about the endpoint', async () => {
    const get = vi
      .fn<TripoFetch>()
      .mockImplementationOnce(() =>
        Promise.resolve(
          answer({ code: 1007, status: 'error', message: 'slow down' }, { status: 429 }),
        ),
      )
      .mockImplementation(() =>
        Promise.resolve(ok({ tasks: [{ task_id: 'a', status: 'queued' }] })),
      )

    const api = apiOn(get)
    await expect(api.status(['a'])).rejects.toMatchObject({ code: 1007 })
    expect(await api.status(['a'])).toEqual([{ taskId: 'a', status: 'queued', outputUrls: {} }])

    expect(get.mock.calls.map(call => call[0])).toEqual([
      'https://tripo.test/v3/tasks/list',
      'https://tripo.test/v3/tasks/list',
    ])
  })
})

describe('a balance that came back without one', () => {
  // 🛑 A zero drawn beside a key holding hundreds is the one outcome this must not produce.
  it('refuses rather than answer nothing left', async () => {
    const get = vi.fn<TripoFetch>().mockResolvedValue(ok({ frozen: 20 }))

    await expect(apiOn(get).balance()).rejects.toThrow(/unreadable/)
  })
})

/**
 * 🛑 MEASURED 2026-08-31 against the live service: `data.tasks` is an OBJECT INDEXED BY TASK ID.
 * Read as an array — which is what the plan and every neighbouring endpoint suggested — the
 * grouped read answered nothing, and the studio quietly fell back to one request per task.
 */
describe('the shape their grouped read actually answers', () => {
  it('reads the map they index by task id', async () => {
    const get = vi.fn<TripoFetch>().mockResolvedValue(
      ok({
        tasks: {
          'uuid-a': { status: 'success', progress: 100, credits_consumed: 10 },
          'uuid-b': { status: 'running', progress: 40 },
        },
      }),
    )

    expect(await apiOn(get).status(['uuid-a', 'uuid-b'])).toEqual([
      { taskId: 'uuid-a', status: 'success', progress: 1, credits: 10, outputUrls: {} },
      { taskId: 'uuid-b', status: 'running', progress: 0.4, outputUrls: {} },
    ])
  })

  // Kept for the day it follows its neighbours: nothing says the shape is settled.
  it('reads a list too, and asks for no fallback either way', async () => {
    const get = vi
      .fn<TripoFetch>()
      .mockResolvedValue(ok({ tasks: [{ task_id: 'uuid-a', status: 'queued' }] }))

    expect(await apiOn(get).status(['uuid-a'])).toEqual([
      { taskId: 'uuid-a', status: 'queued', outputUrls: {} },
    ])
    expect(get).toHaveBeenCalledTimes(1)
  })
})
