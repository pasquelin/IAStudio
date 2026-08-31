import { aiRoleId } from '@shared/domain/aiRole'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import type { Job } from '@shared/domain/job'
import type { ModelSummary } from '@shared/domain/model'
import { DEFAULT_SETTINGS, type Settings } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useSettings } from '@/stores/settings'
import { armCommandScope, subscribeToCommands } from '@/services/commandBus'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { job as jobOf } from '@/stores/job-fixtures'
import { useJobs } from '@/stores/jobs'
import { useProject } from '@/stores/project'
import { registerGenerator, type ArmedGeneration, type GeneratorBridge } from './generatorBridge'
import { ACTION_REGISTRY, commitmentOfCall, type ActionOutcome } from '@shared/domain/assistant'
import { registerConfirmer, type ConfirmAnswer, type ConfirmRequest } from './confirm'
import { forgetConsentsForTests } from './wireConsent'
import {
  handledActions,
  resetDelegatedSpendForTests,
  runAction,
  runConfirmedAction,
} from './executor'

const WHEN = '2026-08-17T10:00:00.000Z'

/** A person at the screen: the yes or the no, and the input handed back as it came. */
const saying =
  (granted: boolean) =>
  (request: ConfirmRequest): Promise<ConfirmAnswer> =>
    Promise.resolve({ granted, input: request.input })

/** The English half of a refusal, which is where the token and what it covers are spelled out. */
const refusalDetail = (outcome: ActionOutcome): string => (outcome.ok ? '' : (outcome.detail ?? ''))

/** Read as the shape it is rather than by the words around it, which are a bundle line. */
const tokensOf = (detail: string): readonly string[] =>
  detail.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? []

const tokenOf = (detail: string): string => tokensOf(detail)[0] ?? ''

const showWorkspace = vi.hoisted(() => vi.fn())
const createDocumentIn = vi.hoisted(() => vi.fn())
const revealTool = vi.hoisted(() => vi.fn())

vi.mock('@/app/dockviewApi', () => ({ showWorkspace }))
vi.mock('@/app/newDocument', () => ({ createDocumentIn }))
vi.mock('@/helpers/revealPanel', () => ({ revealTool }))

function onImageDocument(): void {
  useLayouts.setState({ activeWorkspace: 'image', home: false })
}

const aModel = (id: string, name: string): ModelSummary => ({
  id,
  name,
  family: '3d',
  runsOn: SCENARIO_CLOUD,
  source: 'scenario',
  origin: 'official',
  featured: false,
  capabilities: [],
  tags: [],
})

/** The shared factory, told the label and the progress this suite reads a job by. */
const aJob = (id: string): Job => jobOf({ id, label: 'Knight', progress: 0.5 })

/** A mounted generator, armed on a model and carrying no references unless a case says so. */
const ARMED: ArmedGeneration = {
  modelId: 'm',
  operation: 'image/txt2img',
  family: 'image',
  sources: [],
  landing: { target: 'newTab', derived: 'newTab', into: null, creates: null, sends: null },
  parameters: {},
}

const aGenerator = (overrides: Partial<GeneratorBridge> = {}): GeneratorBridge => ({
  body: () => ({ modelId: 'm', values: {} }),
  armed: () => ARMED,
  submit: () => Promise.resolve(null),
  references: () => [],
  ...overrides,
})

/** The real gesture opens a native folder dialog, which a test has none of. */
const createPicked = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  installFakeBridge()
  onImageDocument()
  useProject.setState({ createPicked })
})

describe('opening a workspace', () => {
  const stamp = '2026-08-17T10:00:00.000Z'
  const madeDocument = {
    id: 'doc-9',
    kind: 'scene',
    workspace: '3d',
    title: 'Niveau',
    path: 'documents/Niveau.gltf',
  }

  beforeEach(() => {
    useProject.setState({
      project: {
        path: '/projects/one',
        manifest: { version: 1, name: 'One', createdAt: stamp, updatedAt: stamp },
      },
    })
    createDocumentIn.mockResolvedValue(madeDocument)
  })

  it('switches to it', async () => {
    expect(await runAction('workspace.open', { workspace: '3d' })).toEqual({ ok: true })

    expect(showWorkspace).toHaveBeenCalledWith('3d')
    expect(createDocumentIn).not.toHaveBeenCalled()
  })

  it('makes a document there when asked to', async () => {
    await runAction('workspace.open', { workspace: '3d', createDocument: true })

    // Nothing named: the field opens, which is what a person at the window expects.
    expect(createDocumentIn).toHaveBeenCalledWith('3d', undefined)
    expect(showWorkspace).not.toHaveBeenCalled()
  })

  /**
   * The creation puts a name field on screen. Answering before it is filled told a client the
   * document was there while the person was still deciding — and it stayed "done" when they
   * pressed Cancel.
   */
  it('answers the document it made, and waits for it', async () => {
    expect(await runAction('workspace.open', { workspace: '3d', createDocument: true })).toEqual({
      ok: true,
      data: { documentId: 'doc-9' },
    })
  })

  // Named by the caller, the creation raises no field — see `createDocumentIn`.
  it('passes on the name and the folder the caller gave', async () => {
    await runAction('workspace.open', {
      workspace: '3d',
      createDocument: true,
      title: 'Niveau',
      folder: 'Repérages',
    })

    expect(createDocumentIn).toHaveBeenCalledWith('3d', { title: 'Niveau', folder: 'Repérages' })
  })

  it('leaves the folder out when only a name was given', async () => {
    await runAction('workspace.open', { workspace: '3d', createDocument: true, title: 'Niveau' })

    expect(createDocumentIn).toHaveBeenCalledWith('3d', { title: 'Niveau' })
  })

  it('refuses when the name field is called off', async () => {
    createDocumentIn.mockResolvedValue(null)

    expect(
      await runAction('workspace.open', { workspace: '3d', createDocument: true }),
    ).toMatchObject({
      ok: false,
      refusal: 'declined',
    })
  })

  it('refuses to make one with no project to write it in', async () => {
    useProject.setState({ project: null })

    expect(
      await runAction('workspace.open', { workspace: '3d', createDocument: true }),
    ).toMatchObject({
      ok: false,
      refusal: 'noProject',
    })
    expect(createDocumentIn).not.toHaveBeenCalled()
  })

  it('refuses a workspace the studio has no panel for', async () => {
    const outcome = await runAction('workspace.open', { workspace: 'holodeck' })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(showWorkspace).not.toHaveBeenCalled()
  })
})

describe('running a command', () => {
  it('hands it to the surface listening for it', async () => {
    const heard: string[] = []
    const stop = subscribeToCommands(command => heard.push(command) > 0)
    const disarm = armCommandScope('canvas')

    expect(await runAction('command.runStudioCommand', { command: 'canvas.zoomIn' })).toEqual({
      ok: true,
    })

    expect(heard).toEqual(['canvas.zoomIn'])
    disarm()
    stop()
  })

  /**
   * The defect this whole check exists for: the bus is memoryless and the subscriber filters by
   * scope, so a command for a surface nothing has mounted vanishes without a word. Reported as
   * having run, the assistant would be lying about the one thing it is asked to be reliable on.
   */
  it('says so rather than dropping a command no surface is there to take', async () => {
    const heard: string[] = []
    const stop = subscribeToCommands(command => heard.push(command) > 0)

    const outcome = await runAction('command.runStudioCommand', { command: 'scene.frame' })

    expect(outcome).toMatchObject({ ok: false, refusal: 'wrongSurface' })
    expect(heard).toEqual([])
    stop()
  })

  /**
   * `badInput` and not `unknownCommand`, because the field closes over every declared id: the
   * schema promised the client an enum, so a value outside it never reaches the handler. The
   * handler keeps its own `unknownCommand` all the same — it is what would answer the day the
   * registry and the field parted company.
   */
  it('refuses a command nothing declares, at the schema rather than at the surface', async () => {
    const outcome = await runAction('command.runStudioCommand', { command: 'canvas.summonADragon' })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
  })

  // The catalogue offers these to the model, so refusing them all was the assistant announcing
  // "creating a new project" and then doing nothing at all.
  it('runs the application’s own commands, through the path the native menu takes', async () => {
    const outcome = await runAction('command.runStudioCommand', { command: 'app.settings' })

    expect(outcome).toEqual({ ok: true })
  })

  /**
   * 🛑 Measured on screen: the Finder opened, the person answered it, and the NEXT round ran the
   * same command again — a second Finder over the first, because nothing came back saying what
   * had been chosen. `project.create` takes a name and answers what it made.
   */
  it('refuses a command that raises a system dialogue', async () => {
    const outcome = await runAction('command.runStudioCommand', { command: 'project.new' })

    expect(outcome).toMatchObject({ ok: false, refusal: 'nativeDialog' })
    expect(createPicked).not.toHaveBeenCalled()
  })
})

describe('choosing and preparing a model', () => {
  it('arms a model for its family', async () => {
    expect(await runAction('models.select', { family: 'image', modelId: 'model_x' })).toEqual({
      ok: true,
    })

    expect(useModels.getState().selected[aiRoleId('image', 'txt2img')]).toBe('model_x')
  })

  it('fills the generator without sending anything', async () => {
    await runAction('generator.prepare', {
      family: '3d',
      modelId: 'model_y',
      parameters: { prompt: 'a knight helmet' },
    })

    expect(useModels.getState().preset[aiRoleId('3d', 'txt23d')]).toEqual({
      prompt: 'a knight helmet',
    })
    expect(useModels.getState().selected[aiRoleId('3d', 'txt23d')]).toBe('model_y')
  })

  /**
   * What a model shown only the short list asks with, and what it gets back: the action, what it
   * is for, and the fields it takes — enough to call it on the next turn without seeing the rest.
   */
  it('finds actions the short catalogue never named', async () => {
    const outcome = await runAction('actions.find', { query: 'git branch' })
    const found = outcome.ok ? (outcome.data as { name: string; fields: unknown[] }[]) : []

    expect(found.some(one => one.name === 'git.checkout')).toBe(true)
    expect(found.find(one => one.name === 'git.checkout')?.fields.length).toBeGreaterThan(0)
  })

  it('refuses parameters that are not a set of values', async () => {
    const outcome = await runAction('generator.prepare', {
      family: '3d',
      modelId: 'model_y',
      parameters: 'a knight helmet',
    })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
  })

  it('searches the catalogue and answers what it found', async () => {
    installFakeBridge({
      provider: {
        searchModels: () => Promise.resolve({ items: [aModel('model_z', 'Knight')], cursor: null }),
      },
    })

    const outcome = await runAction('models.search', { query: 'knight', family: '3d' })

    expect(outcome).toEqual({
      ok: true,
      data: [{ id: 'model_z', name: 'Knight', family: '3d' }],
    })
  })
})

describe('submitting what was prepared', () => {
  it('sends the form the panel is showing, and answers the job', async () => {
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    const stop = registerGenerator(aGenerator({ submit }))

    expect(await runAction('generator.submit', {})).toEqual({
      ok: true,
      data: { jobId: 'job_1', landing: 'newTab' },
    })
    // What the panel shows, when the call names nothing: the destination is not re-decided here.
    expect(submit).toHaveBeenCalledWith('newTab')
    stop()
  })

  it('sends it where the call says, over what the panel shows', async () => {
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    const stop = registerGenerator(aGenerator({ submit }))

    await runAction('generator.submit', { landing: 'document' })

    expect(submit).toHaveBeenCalledWith('document')
    stop()
  })

  /**
   * 🛑 Refused rather than guessed: the studio itself would have put the question on screen, and
   * a call from outside cannot answer it — the wrong half writes over a file being edited.
   */
  it('refuses, naming the options, where the studio would have asked', async () => {
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    const stop = registerGenerator(
      aGenerator({
        submit,
        armed: () => ({ ...ARMED, landing: { ...ARMED.landing, target: null } }),
      }),
    )

    const outcome = await runAction('generator.submit', {})

    expect(outcome).toMatchObject({ ok: false, refusal: 'ambiguousLanding' })
    expect(outcome).toMatchObject({ detail: expect.stringContaining('newTab') })
    expect(submit).not.toHaveBeenCalled()
    stop()
  })

  /** The same call, with the destination named, goes through: the refusal is repairable. */
  it('goes through once the ambiguity is named', async () => {
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    const stop = registerGenerator(
      aGenerator({
        submit,
        armed: () => ({ ...ARMED, landing: { ...ARMED.landing, target: null } }),
      }),
    )

    await runAction('generator.submit', { landing: 'newTab' })

    expect(submit).toHaveBeenCalledWith('newTab')
    stop()
  })

  it('opens the generator, and refuses, when no panel is mounted', async () => {
    const outcome = await runAction('generator.submit', {})

    expect(outcome).toMatchObject({ ok: false, refusal: 'generatorClosed' })
    expect(revealTool).toHaveBeenCalledWith('generator')
  })

  /** Read before the spend: what a client sees instead of paying to find out. */
  it('answers the model, the operation and the destination that are armed', async () => {
    const stop = registerGenerator(aGenerator())

    expect(await runAction('generator.readArmedGeneration', {})).toEqual({ ok: true, data: ARMED })
    stop()
  })

  it('refuses to say what is armed with no panel mounted', async () => {
    expect(await runAction('generator.readArmedGeneration', {})).toMatchObject({
      ok: false,
      refusal: 'generatorClosed',
    })
  })

  it('refuses when the panel is up but nothing is armed', async () => {
    const stop = registerGenerator(aGenerator({ armed: () => null }))

    expect(await runAction('generator.submit', {})).toMatchObject({
      ok: false,
      refusal: 'nothingPrepared',
    })
    stop()
  })
})

/**
 * The three the prompt field used to carry as buttons. The channels are untouched — what
 * changed is who presses — so what is worth saying here is where each one reads its input from.
 */
describe('the prompt assistance, now asked for', () => {
  it('writes variants for the model the generator has armed', async () => {
    const suggestPrompts = vi.fn(() => Promise.resolve([{ text: 'a knight', parameters: {} }]))
    installFakeBridge({ provider: { suggestPrompts } })
    const stop = registerGenerator(aGenerator({ body: () => ({ modelId: 'model_x', values: {} }) }))

    const outcome = await runAction('prompt.suggest', { draft: 'un chevalier' })

    expect(suggestPrompts).toHaveBeenCalledWith({ modelId: 'model_x', prompt: 'un chevalier' })
    expect(outcome).toEqual({ ok: true, data: [{ text: 'a knight', parameters: {} }] })
    stop()
  })

  // Suggestions are written FOR a model, so there is no useful answer without one armed.
  it('refuses to suggest with no model armed', async () => {
    installFakeBridge()

    expect(await runAction('prompt.suggest', { draft: 'un chevalier' })).toMatchObject({
      ok: false,
      refusal: 'generatorClosed',
    })
  })

  it('translates what it was handed, and says which language it recognised', async () => {
    installFakeBridge({
      provider: {
        translatePrompt: () => Promise.resolve({ text: 'a knight', detectedLanguage: 'french' }),
      },
    })

    expect(await runAction('prompt.translate', { text: 'un chevalier' })).toEqual({
      ok: true,
      data: { text: 'a knight', detectedLanguage: 'french' },
    })
  })

  it('reads the style off the pictures the form carries, never off a named list', async () => {
    const describeStyle = vi.fn(() => Promise.resolve({ description: 'flat', synthesis: '' }))
    installFakeBridge({ provider: { describeStyle } })
    const stop = registerGenerator(aGenerator({ references: () => ['asset_1'] }))

    const outcome = await runAction('prompt.describeStyle', {})

    expect(describeStyle).toHaveBeenCalledWith(['asset_1'])
    expect(outcome).toEqual({ ok: true, data: { description: 'flat', synthesis: '' } })
    stop()
  })

  it('says there is nothing to read rather than asking about an empty list', async () => {
    installFakeBridge()
    const stop = registerGenerator(aGenerator())

    expect(await runAction('prompt.describeStyle', {})).toMatchObject({
      ok: false,
      refusal: 'noReference',
    })
    stop()
  })
})

describe('listing the jobs', () => {
  /**
   * Whole jobs. Four fields were picked out here — id, label, status, progress — which left a
   * client able to start a generation and unable to learn what it produced.
   */
  it('answers what the studio is tracking, whole', async () => {
    const job = aJob('job_1')
    useJobs.setState({ jobs: [job] })

    expect(await runAction('jobs.list', {})).toEqual({ ok: true, data: [job] })
  })
})

/**
 * The gate. Everything that outlives the window passes through it, whether the call came from
 * the modal or from an MCP client on the other side of the machine — there is one gate, not two.
 */
describe('asking before acting', () => {
  it('does not ask for what is free and undoable', async () => {
    const ask = vi.fn(saying(true))
    const stop = registerConfirmer(ask)

    await runConfirmedAction('workspace.open', { workspace: '3d' })

    expect(ask).not.toHaveBeenCalled()
    expect(showWorkspace).toHaveBeenCalledWith('3d')
    stop()
  })

  /** 🛑 What RUNS is what the CARD left: the folder it names is a place only the person knows. */
  it('runs the input the card amended', async () => {
    const heard: string[] = []
    const stopHearing = subscribeToCommands(command => heard.push(command) > 0)
    const disarm = armCommandScope('canvas')
    const stop = registerConfirmer(() =>
      Promise.resolve({ granted: true, input: { command: 'canvas.enlarge' } }),
    )

    await runConfirmedAction('command.runStudioCommand', { command: 'canvas.cutout' })
    stop()
    disarm()
    stopHearing()

    expect(heard).toEqual(['canvas.enlarge'])
  })

  /**
   * 🛑 What the card SHOWED is what runs: `raises` reads the input, so a value amended on the
   * card could lift the level above the sentence the person read before saying yes.
   */
  it('refuses an amendment the question was not asked about', async () => {
    const stop = registerConfirmer(() => Promise.resolve({ granted: true, input: { nothing: 1 } }))

    const outcome = await runConfirmedAction('command.runStudioCommand', {
      command: 'canvas.cutout',
    })
    stop()

    expect(outcome).toMatchObject({ ok: false, refusal: 'formChanged' })
  })

  it('asks before spending, and quotes what the form would cost', async () => {
    const ask = vi.fn(saying(true))
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    installFakeBridge({
      provider: { estimateCost: () => Promise.resolve({ creativeUnits: 4 }) },
    })
    const stopGenerator = registerGenerator(
      aGenerator({ body: () => ({ modelId: 'model_x', values: { prompt: 'a knight' } }), submit }),
    )
    const stopConfirmer = registerConfirmer(ask)

    await runConfirmedAction('generator.submit', {})

    expect(ask).toHaveBeenCalledWith({
      action: 'generator.submit',
      input: {},
      commitment: 'credits',
      estimate: 4,
    })
    expect(submit).toHaveBeenCalled()
    stopGenerator()
    stopConfirmer()
  })

  it('does not act when the answer is no', async () => {
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    const stopGenerator = registerGenerator(aGenerator({ submit }))
    const stopConfirmer = registerConfirmer(saying(false))

    expect(await runConfirmedAction('generator.submit', {})).toMatchObject({
      ok: false,
      refusal: 'declined',
    })
    expect(submit).not.toHaveBeenCalled()
    stopGenerator()
    stopConfirmer()
  })

  /**
   * The answer that matters for the MCP server: an action arriving from outside while no window
   * is showing the assistant is refused, never granted by default. Spending on a question nobody
   * was shown is the one outcome this whole mechanism exists to prevent.
   */
  it('refuses rather than assuming a yes when nobody can be asked', async () => {
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    const stop = registerGenerator(aGenerator({ submit }))

    expect(await runConfirmedAction('generator.submit', {})).toMatchObject({
      ok: false,
      refusal: 'noConfirmer',
    })
    expect(submit).not.toHaveBeenCalled()
    stop()
  })

  /**
   * What was priced is what goes out, or nothing does.
   *
   * The question may stand for two minutes — that is what a client from outside is given — and
   * the generator panel stays live behind it. Raising the count while "~4 CU" is on screen used
   * to send the new form: the figure was read before the question and the body re-read after the
   * yes, with nothing tying the two together.
   */
  it('sends nothing when the form moved between the figure and the yes', async () => {
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    let count = 1
    installFakeBridge({
      provider: { estimateCost: () => Promise.resolve({ creativeUnits: 4 }) },
    })
    const stopGenerator = registerGenerator(
      aGenerator({ body: () => ({ modelId: 'model_x', values: { count } }), submit }),
    )
    // The hand that changes the form while the question is on screen.
    const stopConfirmer = registerConfirmer(request => {
      count = 10
      return saying(true)(request)
    })

    expect(await runConfirmedAction('generator.submit', {})).toMatchObject({
      ok: false,
      refusal: 'formChanged',
    })
    expect(submit).not.toHaveBeenCalled()
    stopGenerator()
    stopConfirmer()
  })

  // An upload is a permanent asset and earns the question, but there is no figure to quote for
  // it — and one invented to fill the sentence would be worse than none.
  it('asks about an upload without quoting a price', async () => {
    const ask = vi.fn(saying(false))
    const stop = registerConfirmer(ask)

    await runConfirmedAction('command.runStudioCommand', { command: 'canvas.cutout' })

    expect(ask).toHaveBeenCalledWith({
      action: 'command.runStudioCommand',
      input: { command: 'canvas.cutout' },
      commitment: 'asset',
    })
    stop()
  })

  it('says the estimate is unknown rather than inventing one', async () => {
    const ask = vi.fn(saying(false))
    installFakeBridge({ provider: { estimateCost: () => Promise.reject(new Error('no price')) } })
    const stopGenerator = registerGenerator(aGenerator())
    const stopConfirmer = registerConfirmer(ask)

    await runConfirmedAction('generator.submit', {})

    expect(ask).toHaveBeenCalledWith({
      action: 'generator.submit',
      input: {},
      commitment: 'credits',
      estimate: null,
    })
    stopGenerator()
    stopConfirmer()
  })
})

/**
 * A caller with no screen on this machine. What is measured here is that the gate did not move:
 * it engages nothing before it has said what it engages, and a token answers for one call only.
 */
describe('asking across the wire', () => {
  beforeEach(() => {
    forgetConsentsForTests()
    resetDelegatedSpendForTests()
    useSettings.setState({ settings: DEFAULT_SETTINGS })
  })

  it('runs what engages nothing, without a token', async () => {
    expect(await runConfirmedAction('workspace.open', { workspace: '3d' }, {})).toMatchObject({
      ok: true,
    })
  })

  it('names what a call engages rather than asking a screen that is not there', async () => {
    const ask = vi.fn(saying(true))
    const stop = registerConfirmer(ask)

    const outcome = await runConfirmedAction('project.create', { name: 'p' }, {})

    expect(outcome).toMatchObject({ ok: false, refusal: 'needsConsent' })
    expect(refusalDetail(outcome)).toContain('the studio’s own state')
    expect(ask).not.toHaveBeenCalled()
    stop()
  })

  it('runs the same call when it comes back with the token', async () => {
    const cutout = { command: 'canvas.cutout' }
    const first = await runConfirmedAction('command.runStudioCommand', cutout, {})
    const consent = tokenOf(refusalDetail(first))

    // Past the gate, which is the whole of what a token buys. What the surface then makes of the
    // command is `coreHandlers`' own case, not this one's.
    expect(
      await runConfirmedAction('command.runStudioCommand', cutout, { consent }),
    ).not.toMatchObject({
      refusal: 'needsConsent',
    })
  })

  it('does not let a token answer for a call it was not minted for', async () => {
    const first = await runConfirmedAction(
      'command.runStudioCommand',
      { command: 'canvas.cutout' },
      {},
    )
    const consent = tokenOf(refusalDetail(first))

    expect(
      await runConfirmedAction(
        'command.runStudioCommand',
        { command: 'canvas.enlarge' },
        { consent },
      ),
    ).toMatchObject({ ok: false, refusal: 'needsConsent' })
  })

  /**
   * 🛑 The one a lot hides: `studio.batch` engages nothing, so it runs before the gate — and its
   * calls fell back on a modal no client can see, each holding the round trip for two minutes.
   */
  it('carries the door down into a lot, so its calls are asked across the wire too', async () => {
    const stop = registerConfirmer(saying(true))
    const calls = JSON.stringify([
      { action: 'command.runStudioCommand', input: { command: 'canvas.cutout' } },
    ])

    const outcome = await runConfirmedAction('studio.batch', { calls }, {})

    expect(outcome).toMatchObject({ ok: false, refusal: 'needsConsent' })
    expect(refusalDetail(outcome)).toContain('call 1')
    stop()
  })

  /**
   * 🛑 What a lot did before it refused. Stopping at the first call wanting a token left the ones
   * before it acted on, and the client sending the lot back with that token ran them twice.
   */
  it('runs nothing at all when a later call of a lot wants a token', async () => {
    const calls = JSON.stringify([
      { action: 'workspace.open', input: { workspace: '3d' } },
      { action: 'command.runStudioCommand', input: { command: 'canvas.cutout' } },
    ])

    expect(await runConfirmedAction('studio.batch', { calls }, {})).toMatchObject({
      ok: false,
      refusal: 'needsConsent',
    })
    expect(showWorkspace).not.toHaveBeenCalled()
  })

  /** One round trip rather than one per engaging call, which is the whole point of a lot. */
  it('hands back a token for every call of the lot that was missing one', async () => {
    const calls = [
      { action: 'command.runStudioCommand', input: { command: 'canvas.cutout' } },
      { action: 'project.create', input: { name: 'p' } },
    ]

    const first = await runConfirmedAction('studio.batch', { calls: JSON.stringify(calls) }, {})
    const tokens = tokensOf(refusalDetail(first))

    expect(tokens).toHaveLength(2)
    expect(refusalDetail(first)).toContain('call 2')

    // Sent back with each call carrying its own, the lot is past the gate. What the surfaces then
    // make of the calls is their own case, not this one's.
    const armed = calls.map((one, at) => ({ ...one, input: { ...one.input, consent: tokens[at] } }))
    expect(
      await runConfirmedAction('studio.batch', { calls: JSON.stringify(armed) }, {}),
    ).not.toMatchObject({ refusal: 'needsConsent' })
  })

  /**
   * 🛑 The loop a token burnt too early makes: refused because of call two, call one's yes must
   * still stand, or the lot comes back one token short of a different call every round.
   */
  it('leaves a token standing when the lot it answered for is refused', async () => {
    const one = { action: 'command.runStudioCommand', input: { command: 'canvas.cutout' } }
    const two = { action: 'project.create', input: { name: 'p' } }

    const first = await runConfirmedAction('studio.batch', { calls: JSON.stringify([one]) }, {})
    const armedOne = { ...one, input: { ...one.input, consent: tokenOf(refusalDetail(first)) } }

    // Call one arrives armed and call two does not: ONE fresh token comes back, not two.
    const second = await runConfirmedAction(
      'studio.batch',
      { calls: JSON.stringify([armedOne, two]) },
      {},
    )
    expect(tokensOf(refusalDetail(second))).toHaveLength(1)
    expect(refusalDetail(second)).toContain('call 2')

    const armedTwo = { ...two, input: { ...two.input, consent: tokenOf(refusalDetail(second)) } }
    expect(
      await runConfirmedAction('studio.batch', { calls: JSON.stringify([armedOne, armedTwo]) }, {}),
    ).not.toMatchObject({ refusal: 'needsConsent' })
  })

  /** 🛑 One yes, one call: `holdsConsent` does not spend, so the same token offered twice in a
   * lot cleared both calls. */
  it('refuses a lot that offers one token for two calls', async () => {
    const call = { action: 'command.runStudioCommand', input: { command: 'canvas.cutout' } }
    const first = await runConfirmedAction('studio.batch', { calls: JSON.stringify([call]) }, {})
    const armed = { ...call, input: { ...call.input, consent: tokenOf(refusalDetail(first)) } }

    const outcome = await runConfirmedAction(
      'studio.batch',
      { calls: JSON.stringify([armed, armed]) },
      {},
    )

    expect(outcome).toMatchObject({ ok: false, refusal: 'needsConsent' })
    expect(refusalDetail(outcome)).toContain('call 2')
    expect(refusalDetail(outcome)).not.toContain('call 1')
  })

  /** 🛑 A lot that stops at call one must leave standing the token of the call it never ran, or
   * the retry asks again for a yes already given. */
  it('spends a token only when its own call runs', async () => {
    const stops = { action: 'game.export', input: {} }
    const engages = { action: 'project.create', input: { name: 'p' } }
    const asked = await runConfirmedAction(
      'studio.batch',
      { calls: JSON.stringify([stops, engages]) },
      {},
    )
    const armed = [
      stops,
      { ...engages, input: { ...engages.input, consent: tokenOf(refusalDetail(asked)) } },
    ]

    const first = await runConfirmedAction('studio.batch', { calls: JSON.stringify(armed) }, {})
    const again = await runConfirmedAction('studio.batch', { calls: JSON.stringify(armed) }, {})

    expect(refusalDetail(first)).toContain('call 1')
    expect(again).not.toMatchObject({ refusal: 'needsConsent' })
    expect(refusalDetail(again)).toContain('call 1')
  })

  /** 🛑 A token offered to a call the delegation covers is spent all the same: left standing it
   * answers a second time, for a spend the ceiling no longer covers. */
  it('spends a token the delegation made unnecessary', async () => {
    installFakeBridge({ provider: { estimateCost: () => Promise.resolve({ creativeUnits: 6 }) } })
    const stopGenerator = registerGenerator(
      aGenerator({ submit: () => Promise.resolve(aJob('job_1')) }),
    )
    const asked = await runConfirmedAction('generator.submit', {}, {})
    const consent = tokenOf(refusalDetail(asked))

    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, mcp: { ...DEFAULT_SETTINGS.mcp, delegateBudget: 10 } },
    })
    // Armed for ten: the call runs on the delegation, and the token it carried goes with it.
    expect(await runConfirmedAction('generator.submit', {}, { consent })).toMatchObject({
      ok: true,
    })
    expect(await runConfirmedAction('generator.submit', {}, { consent })).toMatchObject({
      ok: false,
      refusal: 'needsConsent',
    })
    stopGenerator()
  })

  /**
   * 🛑 The ledger the two doors share. A token spends with nobody at the screen, exactly as a
   * delegated call does — counted on the checkbox door alone, the ceiling bounded nothing.
   */
  it('debits the delegated budget for a spend a token let through', async () => {
    installFakeBridge({ provider: { estimateCost: () => Promise.resolve({ creativeUnits: 6 }) } })
    const stopGenerator = registerGenerator(
      aGenerator({ submit: () => Promise.resolve(aJob('job_1')) }),
    )

    // Nothing armed, so a token is the only way through — and it spends six.
    const asked = await runConfirmedAction('generator.submit', {}, {})
    // The figure the modal quotes, not a bare number: one sentence for both doors.
    expect(refusalDetail(asked)).toContain('~6')
    const consent = tokenOf(refusalDetail(asked))
    expect(await runConfirmedAction('generator.submit', {}, { consent })).toMatchObject({
      ok: true,
    })

    // Armed for ten AFTER the fact: six are already gone, so six more are past the ceiling.
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, mcp: { ...DEFAULT_SETTINGS.mcp, delegateBudget: 10 } },
    })
    expect(await runConfirmedAction('generator.submit', {}, {})).toMatchObject({
      ok: false,
      refusal: 'needsConsent',
    })
    stopGenerator()
  })

  // The window's own door is untouched: no token reaches it, and it still asks its screen.
  it('leaves the window asking on the glass', async () => {
    const ask = vi.fn(saying(false))
    const stop = registerConfirmer(ask)

    await runConfirmedAction('command.runStudioCommand', { command: 'canvas.cutout' })

    expect(ask).toHaveBeenCalled()
    stop()
  })
})

/**
 * Delegation is what lets a client run while nobody is at the machine, and it is the one feature
 * of this file that can spend somebody's money unwatched. Every case here is about a refusal.
 */
describe('what an armed studio lets through without asking', () => {
  const arm = (partial: Partial<Settings['mcp']>): void => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, mcp: { ...DEFAULT_SETTINGS.mcp, ...partial } },
    })
  }

  beforeEach(() => {
    resetDelegatedSpendForTests()
    useSettings.setState({ settings: DEFAULT_SETTINGS })
  })

  it('asks about everything while nothing is armed', async () => {
    const ask = vi.fn(saying(false))
    const stop = registerConfirmer(ask)

    await runConfirmedAction('command.runStudioCommand', { command: 'canvas.cutout' })

    expect(ask).toHaveBeenCalled()
    stop()
  })

  it('runs an armed level with nobody to ask at all', async () => {
    arm({ delegateAsset: true })

    // No confirmer registered: without the delegation this is `noConfirmer`, which is the whole
    // of what "a client working while nobody is at the machine" used to run into.
    expect(
      await runConfirmedAction('command.runStudioCommand', { command: 'canvas.cutout' }),
    ).not.toMatchObject({
      ok: false,
      refusal: 'noConfirmer',
    })
  })

  it('spends up to the budget, then asks again', async () => {
    arm({ delegateBudget: 5 })
    installFakeBridge({ provider: { estimateCost: () => Promise.resolve({ creativeUnits: 3 }) } })
    const stopGenerator = registerGenerator(
      aGenerator({ submit: () => Promise.resolve(jobOf({ id: 'job_1' })) }),
    )

    // Three of five: through. Three more is six, which is past five — so the second one asks, and
    // with nobody registered to ask it refuses.
    expect(await runConfirmedAction('generator.submit', {})).toMatchObject({ ok: true })
    expect(await runConfirmedAction('generator.submit', {})).toMatchObject({
      ok: false,
      refusal: 'noConfirmer',
    })
    stopGenerator()
  })

  /** A ceiling cannot bound a cost nobody knows, so an unpriced spend is asked about regardless. */
  it('asks about a spend the API declined to price, whatever the budget', async () => {
    arm({ delegateBudget: 10_000 })
    installFakeBridge({ provider: { estimateCost: () => Promise.reject(new Error('no price')) } })
    const stopGenerator = registerGenerator(aGenerator())

    expect(await runConfirmedAction('generator.submit', {})).toMatchObject({
      ok: false,
      refusal: 'noConfirmer',
    })
    stopGenerator()
  })
})

describe('the table of handlers', () => {
  /**
   * Both directions, because both misses are silent. An action published with nothing behind it
   * answers `badInput` to every client that read `tools/list` and believed the tool existed; a
   * handler nothing publishes is code no door can reach. Neither the compiler nor the schema
   * sees either — the table is `Partial` by construction, one family per module.
   */
  it('answers every action the registry publishes, and no name it does not', () => {
    expect([...handledActions()].sort()).toEqual(ACTION_REGISTRY.map(entry => entry.name).sort())
  })
})

describe('an input the registry would not accept', () => {
  /**
   * The gate is `runConfirmedAction` and nowhere else, which is what lets each handler read its
   * input plainly. Checked through the confirmed door rather than on `validatesInput` directly:
   * what this holds is the wiring, and the wiring is what was missing.
   */
  it('is refused before the action runs at all', async () => {
    onImageDocument()

    expect(await runConfirmedAction('workspace.open', { workspace: 'nowhere' })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(await runConfirmedAction('workspace.open', { worksapce: '3d' })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(showWorkspace).not.toHaveBeenCalled()
  })

  // A costly action with a bad input must not raise the question first: the person would be
  // asked to approve a spend that was never going to happen.
  it('is refused without anybody being asked', async () => {
    const ask = vi.fn(saying(true))
    const stop = registerConfirmer(ask)

    expect(await runConfirmedAction('generator.submit', { unexpected: 1 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(ask).not.toHaveBeenCalled()
    stop()
  })
})

describe('what a call engages', () => {
  it('spends credits only by submitting', () => {
    expect(commitmentOfCall('generator.submit', {})).toBe('credits')
    expect(commitmentOfCall('generator.prepare', {})).toBe('none')
    expect(commitmentOfCall('workspace.open', { workspace: '3d' })).toBe('none')
  })

  it('reads the commitment of the command a run names, not of the action', () => {
    expect(commitmentOfCall('command.runStudioCommand', { command: 'canvas.cutout' })).toBe('asset')
    expect(commitmentOfCall('command.runStudioCommand', { command: 'canvas.zoomIn' })).toBe('none')
  })

  // Recording a version adds one; amending REPLACES the one already there, message and parent
  // with it — the same loss `git.restore` is asked about, and it went through unasked.
  it('asks before an amend rewrites the version already recorded', () => {
    expect(commitmentOfCall('git.commit', { message: 'Un lot' })).toBe('none')
    expect(commitmentOfCall('git.commit', { message: 'Un lot', amend: true })).toBe('files')
  })
})

describe('a handler that throws rather than refuses', () => {
  /**
   * 🛑 The one silence a model cannot repair from. Left to climb, the rejection reached the bare
   * catch of the turn and marked it LOST: « L'assistant n'a pas su répondre à cette demande »,
   * over a studio that had just written the reason in its journal.
   */
  it('answers with the reason instead of losing the whole turn', async () => {
    installFakeBridge({
      project: {
        listFolder: vi.fn(() => Promise.reject(new Error('EACCES: permission denied'))),
      },
    })
    useProject.setState({
      project: {
        path: '/tmp/Film',
        manifest: { version: 1, name: 'Film', createdAt: WHEN, updatedAt: WHEN },
      },
    })

    expect(await runAction('files.list', { folder: 'Plans' })).toEqual({
      ok: false,
      refusal: 'failed',
      detail: 'EACCES: permission denied',
    })
  })
})
