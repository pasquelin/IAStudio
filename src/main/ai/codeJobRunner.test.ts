import { describe, expect, it, vi } from 'vitest'
import { cloudModelId } from '@shared/domain/codeGeneration'
import { createCodeJobRunner, type CodeJobDeps } from './codeJobRunner'

function answering(body: unknown, status = 200): CodeJobDeps['post'] {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }))
}

function runnerWith(post: CodeJobDeps['post'], deps: Partial<CodeJobDeps> = {}) {
  let at = 0

  return createCodeJobRunner({
    chatOf: () => ({ kind: 'anthropic', model: 'claude-sonnet-4-5' }),
    keyOf: () => 'a-key',
    modelOf: () => undefined,
    post,
    // No waiting in a suite: what the backoff DOES is `retry.test.ts`, and what this file is
    // about is the outcome a refusal settles on.
    retry: action => action(),
    newId: () => `${(at += 1)}`,
    log: () => {},
    ...deps,
  })
}

const ANTHROPIC = cloudModelId('anthropic')

/**
 * Polls until the round trip the submission started has settled.
 *
 * A loop rather than a fixed count of ticks: the answer travels through a `fetch` and a `json()`,
 * so how many microtasks it takes is the runtime's business and not this test's.
 */
async function finished(runner: ReturnType<typeof runnerWith>, jobId: string) {
  for (let at = 0; at < 50; at += 1) {
    const job = await runner.poll(jobId)
    if (job.status !== 'in-progress') return job
  }

  throw new Error('the job never settled')
}

describe('a script written by a chat cloud', () => {
  it('answers the script the cloud sent back, with its fence taken off', async () => {
    const runner = runnerWith(answering({ content: [{ text: '```ts\nexport const x = 1\n```' }] }))

    const submitted = await runner.submit({ id: ANTHROPIC }, { prompt: 'a spin' })

    expect((await finished(runner, submitted.jobId)).text).toBe('export const x = 1')
  })

  it('files nothing on the shelf — a script is a document, not an asset', async () => {
    const runner = runnerWith(answering({ content: [{ text: 'export const x = 1' }] }))

    const submitted = await runner.submit({ id: ANTHROPIC }, { prompt: 'a spin' })

    expect((await finished(runner, submitted.jobId)).assetIds).toEqual([])
  })

  it('sends the script at hand beside the words when one is being reworked', async () => {
    const post = answering({ content: [{ text: 'export const x = 2' }] })
    const runner = runnerWith(post)

    const submitted = await runner.submit(
      { id: ANTHROPIC },
      { prompt: 'slow it', source: 'export const x = 1' },
    )
    await finished(runner, submitted.jobId)

    const body = String(vi.mocked(post).mock.calls[0]?.[1]?.body)
    expect(body).toContain('export const x = 1')
  })

  /** 🛑 A key that is not held is an OUTCOME, never a throw the manager would retry. */
  it('refuses as a finished job when no account is held', async () => {
    const runner = runnerWith(answering({}), { keyOf: () => null })

    const submitted = await runner.submit({ id: ANTHROPIC }, { prompt: 'a spin' })

    expect(submitted.status).toBe('failure')
    expect(submitted.error).toBe('missing')
  })

  it('refuses a model id that names no cloud this build knows', async () => {
    const runner = runnerWith(answering({}))

    expect((await runner.submit({ id: 'cloud:gone' }, {})).status).toBe('failure')
  })

  it('owns the jobs it issued, and no others', async () => {
    const runner = runnerWith(answering({ content: [{ text: 'x' }] }))

    const submitted = await runner.submit({ id: ANTHROPIC }, { prompt: 'a spin' })

    expect(runner.owns(submitted.jobId)).toBe(true)
    expect(runner.owns('local_1')).toBe(false)
  })

  it('reports the refusal of a cloud as a failure rather than an empty script', async () => {
    const runner = runnerWith(answering({ error: { message: 'nope' } }, 401))

    const submitted = await runner.submit({ id: ANTHROPIC }, { prompt: 'a spin' })

    expect(await finished(runner, submitted.jobId)).toMatchObject({
      status: 'failure',
      // 🛑 The STATUS, not a generic refusal: a key to fix and a quota to wait out send a person
      // to two different places, and both read as "rejected" before this.
      error: 'invalid-credentials',
    })
  })

  it('waits and comes back on a quota rather than failing the generation', async () => {
    let attempts = 0
    const runner = runnerWith(
      vi.fn(async () => {
        attempts += 1
        return attempts === 1
          ? new Response('{}', { status: 429 })
          : new Response(JSON.stringify({ content: [{ text: 'export const x = 1' }] }))
      }),
      {
        retry: async action => {
          try {
            return await action()
          } catch {
            // One retry, which is what a 429 needs here — the backoff itself is `retry.test.ts`.
            return await action()
          }
        },
      },
    )

    const submitted = await runner.submit({ id: ANTHROPIC }, { prompt: 'a spin' })

    expect((await finished(runner, submitted.jobId)).text).toBe('export const x = 1')
  })
})
