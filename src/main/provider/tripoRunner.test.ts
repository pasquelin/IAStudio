import { describe, expect, it, vi } from 'vitest'
import { TRIPO_CATALOGUE, tripoModelId, type TripoEntry } from '@shared/domain/tripo'
import type { TripoApi, TripoTask } from './tripoApi'
import {
  createTripoRunner,
  extensionOfUrl,
  tripoLaneLimit,
  tripoLaneOf,
  type TripoRunnerDeps,
} from './tripoRunner'

const entryOn = (endpoint: string): TripoEntry => {
  const entry = TRIPO_CATALOGUE.find(one => one.endpoint === endpoint && one.model === 'tripo-v3.1')
  if (!entry) throw new Error(`no ${endpoint} in the catalogue`)
  return entry
}

const TEXT_TO_MODEL = entryOn('generation/text-to-model')
const IMAGE_TO_MODEL = entryOn('generation/image-to-model')

const TEXT_TARGET = { id: tripoModelId(TEXT_TO_MODEL) }
const IMAGE_TARGET = { id: tripoModelId(IMAGE_TO_MODEL) }

type Written = { path: string; bytes: Uint8Array }

function harness(tasks: readonly TripoTask[] = [], overrides: Partial<TripoRunnerDeps> = {}) {
  const written: Written[] = []
  const api = {
    create: vi.fn<TripoApi['create']>(() => Promise.resolve('9a1c-5248')),
    status: vi.fn<TripoApi['status']>(ids =>
      Promise.resolve(tasks.filter(task => ids.includes(task.taskId))),
    ),
    upload: vi.fn<TripoApi['upload']>(() => Promise.resolve('file-token-1')),
    balance: vi.fn<TripoApi['balance']>(() => Promise.resolve({ balance: 5000, frozen: 0 })),
  }

  const runner = createTripoRunner({
    api: () => api,
    download: () => Promise.resolve(new Uint8Array([7, 7])),
    readFile: () => Promise.resolve(new Uint8Array([1])),
    writeFile: (path, bytes) => {
      written.push({ path, bytes })
      return Promise.resolve()
    },
    destinationFor: (taskId, extension) => Promise.resolve(`/tmp/${taskId}.${extension}`),
    gather: () => Promise.resolve(),
    log: () => {},
    ...overrides,
  })

  return { runner, api, written }
}

describe('submitting to Tripo', () => {
  it('names the endpoint the entry names, and the model beside it', async () => {
    const { runner, api } = harness()

    const job = await runner.submit(TEXT_TARGET, { prompt: 'a hat', texture: false })

    expect(job).toEqual({ jobId: '9a1c-5248', status: 'queued', assetIds: [] })
    expect(api.create).toHaveBeenCalledWith('generation/text-to-model', {
      model: 'tripo-v3.1',
      prompt: 'a hat',
      texture: false,
    })
  })

  /** Their defaults are documented; an explicit null is not one of them. */
  it('leaves an untouched knob out rather than sending an empty one', async () => {
    const { runner, api } = harness()

    await runner.submit(TEXT_TARGET, { prompt: 'a hat', negative_prompt: '', face_limit: null })

    expect(api.create.mock.calls[0]?.[1]).toEqual({ model: 'tripo-v3.1', prompt: 'a hat' })
  })

  it('carries nothing the entry does not publish as a field', async () => {
    const { runner, api } = harness()

    await runner.submit(TEXT_TARGET, { prompt: 'a hat', somethingElse: 'no' })

    expect(api.create.mock.calls[0]?.[1]).not.toHaveProperty('somethingElse')
  })

  /**
   * The picture arrives as a PATH — a Tripo body goes through the LOCAL resolver, so nothing of
   * it was ever pushed to another cloud's library. It goes up to TRIPO here, and to nobody else.
   */
  it('sends a picture up to Tripo and puts its token in the body', async () => {
    const { runner, api } = harness()

    await runner.submit(IMAGE_TARGET, { input: '/projects/kingdom/assets/hat.png' })

    expect(api.upload).toHaveBeenCalledWith('hat.png', expect.anything(), 'image/png')
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({ input: 'file-token-1' })
  })

  it('passes a value that is already theirs — a task id, a URL — as it stands', async () => {
    const { runner, api } = harness()

    await runner.submit(IMAGE_TARGET, { input: 'https://theirs/hat.png' })

    expect(api.upload).not.toHaveBeenCalled()
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({ input: 'https://theirs/hat.png' })
  })

  it('refuses a target no entry of this build names', async () => {
    const { runner } = harness()

    await expect(runner.submit({ id: 'tripo:generation/gone:v9' }, {})).rejects.toThrow(/publishes/)
  })

  it('says why nothing can run while no key is held', async () => {
    const { runner } = harness([], { api: () => null })

    await expect(runner.submit(TEXT_TARGET, {})).rejects.toThrow(/no Tripo account/)
  })
})

describe('following a Tripo task', () => {
  it('reads its progress and what it has cost, in credits', async () => {
    const { runner } = harness([
      { taskId: '9a1c-5248', status: 'running', progress: 40, credits: 20 },
    ])

    await runner.submit(TEXT_TARGET, { prompt: 'a hat' })

    expect(await runner.poll('9a1c-5248', TEXT_TARGET)).toEqual({
      jobId: '9a1c-5248',
      status: 'running',
      assetIds: [],
      progress: 40,
      cost: 20,
      costUnit: 'credits',
    })
  })

  /** Their result URLs are signed for five minutes: the poll that sees the success downloads it. */
  it('brings the result down on the poll that saw it succeed', async () => {
    const { runner, written } = harness([
      { taskId: '9a1c-5248', status: 'success', outputUrl: 'https://cdn/x.glb?X-Amz-Signature=ab' },
    ])

    await runner.submit(TEXT_TARGET, { prompt: 'a hat' })
    await runner.poll('9a1c-5248', TEXT_TARGET)

    expect(written).toEqual([{ path: '/tmp/9a1c-5248.glb', bytes: new Uint8Array([7, 7]) }])
    expect(runner.producedBy('9a1c-5248')).toEqual({
      path: '/tmp/9a1c-5248.glb',
      type: 'mesh',
      prompt: 'a hat',
    })
  })

  it('files a picture on the picture shelf', async () => {
    const image = TRIPO_CATALOGUE.find(one => one.endpoint === 'generation/text-to-image')
    const target = { id: tripoModelId(image ?? TEXT_TO_MODEL) }
    const { runner } = harness([
      { taskId: '9a1c-5248', status: 'success', outputUrl: 'https://cdn/x.png' },
    ])

    await runner.submit(target, { prompt: 'a hat' })
    await runner.poll('9a1c-5248', target)

    expect(runner.producedBy('9a1c-5248')?.type).toBe('image')
  })

  it('downloads once, however many times the outcome is polled', async () => {
    const { runner, written } = harness([
      { taskId: '9a1c-5248', status: 'success', outputUrl: 'https://cdn/x.glb' },
    ])

    await runner.submit(TEXT_TARGET, { prompt: 'a hat' })
    await runner.poll('9a1c-5248', TEXT_TARGET)
    await runner.poll('9a1c-5248', TEXT_TARGET)

    expect(written).toHaveLength(1)
  })

  /**
   * 🛑 The case a router keying on ids alone could not serve: a session picking up yesterday's
   * job holds an id this runner never minted, and the TARGET is what says whose it is.
   */
  it('collects a task picked up from a previous session', async () => {
    const { runner } = harness([
      { taskId: 'left-running', status: 'success', outputUrl: 'https://cdn/x.glb' },
    ])

    await runner.poll('left-running', TEXT_TARGET)

    expect(runner.producedBy('left-running')?.path).toBe('/tmp/left-running.glb')
    // Nothing to name it after: the collector falls back on what the note carried, or the label.
    expect(runner.producedBy('left-running')?.prompt).toBe('')
  })

  it('says nothing succeeded when their listing left the task out', async () => {
    const { runner } = harness([])

    await expect(runner.poll('9a1c-5248', TEXT_TARGET)).rejects.toThrow(/said nothing/)
  })

  /** One request for every generation being watched — what their reference recommends over N. */
  it('asks about every task of one beat in a single request', async () => {
    const { runner, api } = harness([
      { taskId: 'a', status: 'running' },
      { taskId: 'b', status: 'running' },
    ])

    await Promise.all([runner.poll('a', TEXT_TARGET), runner.poll('b', TEXT_TARGET)])

    expect(api.status).toHaveBeenCalledTimes(1)
    expect(api.status.mock.calls[0]?.[0]).toEqual(['a', 'b'])
  })

  /**
   * Decision 7: nothing of theirs cancels. Reporting a job as stopped would have somebody
   * believe they stopped a spend that goes on to its end.
   */
  it('refuses to pretend a started task can be stopped', async () => {
    const { runner } = harness()

    await expect(runner.cancel('9a1c-5248', TEXT_TARGET)).rejects.toThrow(/does not stop/)
  })

  it('answers for the tasks it submitted and the ones it filed', async () => {
    const { runner } = harness([{ taskId: '9a1c-5248', status: 'running' }])

    expect(runner.owns('9a1c-5248')).toBe(false)
    await runner.submit(TEXT_TARGET, { prompt: 'a hat' })
    expect(runner.owns('9a1c-5248')).toBe(true)
  })
})

describe('extensionOfUrl', () => {
  /** Their URLs end in `?X-Amz-…`: the last dot of the whole string files a mesh under `.com`. */
  it('reads the path and never the signature', () => {
    expect(extensionOfUrl('https://cdn.tripo.com/x.glb?X-Amz-Date=2026', 'png')).toBe('glb')
    expect(extensionOfUrl('https://cdn.tripo.com/x?X-Amz-Date=2026', 'png')).toBe('png')
    expect(extensionOfUrl('https://cdn.tripo.com/a.very-long-suffix', 'glb')).toBe('glb')
  })
})

describe('the lane a target is counted in', () => {
  it('reads the category off the catalogue, and its published ceiling', () => {
    const lowPoly = TRIPO_CATALOGUE.find(one => one.model === 'tripo-p1')

    expect(tripoLaneOf(TEXT_TARGET.id)).toBe('model-h')
    // Their P series is counted apart from the H one, at half the ceiling.
    expect(tripoLaneOf(tripoModelId(lowPoly ?? TEXT_TO_MODEL))).toBe('model-p')
    expect(tripoLaneLimit('image')).toBe(1)
  })

  it('counts nothing of another runtime', () => {
    expect(tripoLaneOf('model_flux')).toBeNull()
  })
})
