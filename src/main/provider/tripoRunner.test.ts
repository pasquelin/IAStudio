import { describe, expect, it, vi } from 'vitest'
import { TRIPO_CATALOGUE, tripoModelId, type TripoEntry } from '@shared/domain/tripo'
import { isRetryableTripo, type TripoApi, type TripoTask } from './tripoApi'
import { createTripoRunner, tripoLaneOf, type TripoRunnerDeps } from './tripoRunner'

/** By endpoint, and by line where an endpoint serves several — the check and refine take none. */
const entryOn = (endpoint: string, model?: string): TripoEntry => {
  const entry = TRIPO_CATALOGUE.find(
    one => one.endpoint === endpoint && (model === undefined || one.model === model),
  )
  if (!entry) throw new Error(`no ${endpoint} in the catalogue`)
  return entry
}

const LINE = 'v3.1-20260211'
const TEXT_TO_MODEL = entryOn('generation/text-to-model', LINE)
const IMAGE_TO_MODEL = entryOn('generation/image-to-model', LINE)

const RIG_CHECK_TARGET = { id: tripoModelId(entryOn('animations/rig-check')) }
const REFINE_TARGET = { id: tripoModelId(entryOn('models/refine')) }
const MULTIVIEW_TARGET = { id: tripoModelId(entryOn('generation/multiview-to-model', LINE)) }
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
    destinationFor: (taskId, extension) => Promise.resolve(`/tmp/${taskId}${extension}`),
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
      model: 'v3.1-20260211',
      prompt: 'a hat',
      texture: false,
    })
  })

  /** Their defaults are documented; an explicit null is not one of them. */
  it('leaves an untouched knob out rather than sending an empty one', async () => {
    const { runner, api } = harness()

    await runner.submit(TEXT_TARGET, { prompt: 'a hat', negative_prompt: '', face_limit: null })

    expect(api.create.mock.calls[0]?.[1]).toEqual({ model: 'v3.1-20260211', prompt: 'a hat' })
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

    await runner.submit(IMAGE_TARGET, { file: '/projects/kingdom/assets/hat.png' })

    expect(api.upload).toHaveBeenCalledWith('hat.png', expect.anything(), 'image/png')
    // 🛑 An OBJECT, measured: a bare string answers « Cannot construct instance of FileParam ».
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({ file: { file_token: 'file-token-1' } })
  })

  // 🛑 Their refusal names it: « files or inputs are required for multiview_to_model ». One
  // view wrapped into a list of ONE is not what several views is.
  it('sends every view of a multiview up, and keeps them a list', async () => {
    const { runner, api } = harness()

    await runner.submit(MULTIVIEW_TARGET, {
      files: ['/projects/kingdom/front.png', '/projects/kingdom/left.png'],
    })

    expect(api.upload).toHaveBeenCalledTimes(2)
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({
      files: [{ file_token: 'file-token-1' }, { file_token: 'file-token-1' }],
    })
  })

  it('leaves a view already theirs alone while sending the one that is ours', async () => {
    const { runner, api } = harness()

    await runner.submit(MULTIVIEW_TARGET, {
      files: ['https://theirs/front.png', '/projects/kingdom/left.png'],
    })

    expect(api.upload).toHaveBeenCalledTimes(1)
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({
      files: [{ url: 'https://theirs/front.png' }, { file_token: 'file-token-1' }],
    })
  })

  it('passes a value that is already theirs — a task id, a URL — as it stands', async () => {
    const { runner, api } = harness()

    await runner.submit(IMAGE_TARGET, { file: 'https://theirs/hat.png' })

    expect(api.upload).not.toHaveBeenCalled()
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({ file: { url: 'https://theirs/hat.png' } })
  })

  // 🛑 Declared `mesh`, this field spent an upload and was refused 1004: the token it answered
  // went under a field wanting a TASK id. `task` is not a file kind, so nothing goes up.
  it('hands refining the task it was given rather than uploading a file for it', async () => {
    const { runner, api } = harness()

    // A PATH, which is what the asset resolver hands down for an id the form dropped here while
    // the field was declared `mesh` — the shape that spent the upload.
    await runner.submit(REFINE_TARGET, {
      draft_model_task_id: '/projects/kingdom/assets/draft.glb',
    })

    expect(api.upload).not.toHaveBeenCalled()
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({
      draft_model_task_id: '/projects/kingdom/assets/draft.glb',
    })
  })

  /**
   * 🛑 The FIELD says what is a file. Read off the string's shape, a prompt opening on a slash
   * was handed to `readFile` and failed the job on an ENOENT nobody could read.
   */
  it('takes a prompt that looks like a path for the words it is', async () => {
    const { runner, api } = harness()

    await runner.submit(TEXT_TARGET, { prompt: '/robot on a plinth' })

    expect(api.upload).not.toHaveBeenCalled()
    expect(api.create.mock.calls[0]?.[1]).toMatchObject({ prompt: '/robot on a plinth' })
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
      { taskId: '9a1c-5248', status: 'running', progress: 40, credits: 20, outputUrls: {} },
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
      {
        taskId: '9a1c-5248',
        status: 'success',
        outputUrls: { model_url: 'https://cdn/x.glb?X-Amz-Signature=ab' },
      },
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
      {
        taskId: '9a1c-5248',
        status: 'success',
        // Measured: a picture task answers this name ALONE, where a mesh answers three.
        outputUrls: { generated_image_url: 'https://cdn/x.png' },
      },
    ])

    await runner.submit(target, { prompt: 'a hat' })
    await runner.poll('9a1c-5248', target)

    expect(runner.producedBy('9a1c-5248')?.type).toBe('image')
  })

  /**
   * The free rig check writes no file, so `bringDown` has nothing to bring: the sentence travels
   * on the job itself, where the row that draws it reads it.
   */
  it('carries a result that is not a file on the job rather than dropping it', async () => {
    const { runner } = harness([
      {
        taskId: '9a1c-5248',
        status: 'success',
        outputUrls: {},
        output: { riggable: true, rig_type: 'biped' },
      },
    ])

    await runner.submit(RIG_CHECK_TARGET, { input: 'asset-1' })
    const answered = await runner.poll('9a1c-5248', RIG_CHECK_TARGET)

    expect(answered.note).toEqual({
      labelKey: 'tripoRigCheck.riggableAs',
      params: { topology: 'tripoFields.rig_type_biped' },
    })
    // 🛑 Never `text`: the Code space lands that one in an editor for ANY claimed job, so a
    // verdict written there overwrites the script open in the tab.
    expect(answered.text).toBeUndefined()
  })

  // It brings nothing down, so the warning that flags a genuinely lost mesh URL stays rare.
  it('says nothing in the journal about a file it was never going to write', async () => {
    const log = vi.fn()
    const { runner } = harness(
      [{ taskId: '9a1c-5248', status: 'success', outputUrls: {}, output: { riggable: true } }],
      { log },
    )

    await runner.submit(RIG_CHECK_TARGET, { input: 'asset-1' })
    await runner.poll('9a1c-5248', RIG_CHECK_TARGET)

    expect(log).not.toHaveBeenCalled()
  })

  // A mesh task answers `part_names` beside its URLs, and a row is not where that belongs.
  it('says nothing on a job that produced a file', async () => {
    const { runner } = harness([
      {
        taskId: '9a1c-5248',
        status: 'success',
        outputUrls: { model_url: 'https://cdn/x.glb' },
        output: { model_url: 'https://cdn/x.glb', part_names: ['a'] },
      },
    ])

    await runner.submit(TEXT_TARGET, { prompt: 'a hat' })

    expect((await runner.poll('9a1c-5248', TEXT_TARGET)).note).toBeUndefined()
  })

  it('downloads once, however many times the outcome is polled', async () => {
    const { runner, written } = harness([
      { taskId: '9a1c-5248', status: 'success', outputUrls: { model_url: 'https://cdn/x.glb' } },
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
      { taskId: 'left-running', status: 'success', outputUrls: { model_url: 'https://cdn/x.glb' } },
    ])

    await runner.poll('left-running', TEXT_TARGET)

    expect(runner.producedBy('left-running')?.path).toBe('/tmp/left-running.glb')
    // Nothing to name it after: the collector falls back on what the note carried, or the label.
    expect(runner.producedBy('left-running')?.prompt).toBe('')
  })

  /**
   * A retention window, a partial answer. Thrown as one of THEIRS so the backoff decides: a bare
   * `Error` reads as `unexpected` and settles the job on the first attempt.
   */
  it('leaves a task their listing left out to the backoff, rather than dropping it', async () => {
    const { runner } = harness([])

    const failure = await runner.poll('9a1c-5248', TEXT_TARGET).catch((error: unknown) => error)

    expect(isRetryableTripo(failure)).toBe(true)
  })

  /** One request for every generation being watched — what their reference recommends over N. */
  it('asks about every task of one beat in a single request', async () => {
    const { runner, api } = harness([
      { taskId: 'a', status: 'running', outputUrls: {} },
      { taskId: 'b', status: 'running', outputUrls: {} },
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
    const { runner } = harness([{ taskId: '9a1c-5248', status: 'running', outputUrls: {} }])

    expect(runner.owns('9a1c-5248')).toBe(false)
    await runner.submit(TEXT_TARGET, { prompt: 'a hat' })
    expect(runner.owns('9a1c-5248')).toBe(true)
  })
})

describe('the lane a target is counted in', () => {
  it('reads the category off the catalogue, and its published ceiling', () => {
    const lowPoly = TRIPO_CATALOGUE.find(one => one.model === 'P1-20260311')
    const picture = TRIPO_CATALOGUE.find(one => one.family === 'image')

    expect(tripoLaneOf(TEXT_TARGET.id)).toEqual({ name: 'model-h', limit: 10 })
    // Their P series is counted apart from the H one, at half the ceiling.
    expect(tripoLaneOf(tripoModelId(lowPoly ?? TEXT_TO_MODEL))).toEqual({
      name: 'model-p',
      limit: 5,
    })
    expect(tripoLaneOf(tripoModelId(picture ?? TEXT_TO_MODEL))?.limit).toBe(1)
  })

  it('counts nothing of another runtime', () => {
    expect(tripoLaneOf('model_flux')).toBeNull()
  })
})
