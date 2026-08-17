import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Job } from '@shared/domain/job'
import type { ModelSummary } from '@shared/domain/model'
import { installFakeBridge } from '@/services/fakeBridge'
import { subscribeToCommands } from '@/services/commandBus'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { job as jobOf } from '@/stores/job-fixtures'
import { useJobs } from '@/stores/jobs'
import { useProject } from '@/stores/project'
import { registerGenerator, type GeneratorBridge } from './generatorBridge'
import { ACTION_REGISTRY, commitmentOfCall } from '@shared/domain/assistant'
import { registerConfirmer } from './confirm'
import { handledActions, runAction, runConfirmedAction } from './executor'

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
  source: 'scenario',
  origin: 'official',
  featured: false,
  capabilities: [],
  tags: [],
})

/** The shared factory, told the label and the progress this suite reads a job by. */
const aJob = (id: string): Job => jobOf({ id, label: 'Knight', progress: 0.5 })

/** A mounted generator, armed on a model and carrying no references unless a case says so. */
const aGenerator = (overrides: Partial<GeneratorBridge> = {}): GeneratorBridge => ({
  body: () => ({ modelId: 'm', values: {} }),
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
  it('switches to it', async () => {
    expect(await runAction('workspace.open', { workspace: '3d' })).toEqual({ ok: true })

    expect(showWorkspace).toHaveBeenCalledWith('3d')
    expect(createDocumentIn).not.toHaveBeenCalled()
  })

  it('makes a document there when asked to', async () => {
    await runAction('workspace.open', { workspace: '3d', createDocument: true })

    expect(createDocumentIn).toHaveBeenCalledWith('3d')
    expect(showWorkspace).not.toHaveBeenCalled()
  })

  it('refuses a workspace the studio has no panel for', async () => {
    const outcome = await runAction('workspace.open', { workspace: 'holodeck' })

    expect(outcome).toEqual({ ok: false, refusal: 'badInput' })
    expect(showWorkspace).not.toHaveBeenCalled()
  })
})

describe('running a command', () => {
  it('hands it to the surface listening for it', async () => {
    const heard: string[] = []
    const stop = subscribeToCommands(command => heard.push(command))

    expect(await runAction('command.run', { command: 'canvas.zoomIn' })).toEqual({ ok: true })

    expect(heard).toEqual(['canvas.zoomIn'])
    stop()
  })

  /**
   * The defect this whole check exists for: the bus is memoryless and the subscriber filters by
   * scope, so a command for a surface that is not in front vanishes without a word. Reported as
   * having run, the assistant would be lying about the one thing it is asked to be reliable on.
   */
  it('says so rather than dropping a command meant for another surface', async () => {
    const heard: string[] = []
    const stop = subscribeToCommands(command => heard.push(command))

    const outcome = await runAction('command.run', { command: 'scene.frame' })

    expect(outcome).toEqual({ ok: false, refusal: 'wrongSurface' })
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
    const outcome = await runAction('command.run', { command: 'canvas.summonADragon' })

    expect(outcome).toEqual({ ok: false, refusal: 'badInput' })
  })

  // The catalogue offers these to the model, so refusing them all was the assistant announcing
  // "creating a new project" and then doing nothing at all.
  it('runs the application’s own commands, through the path the native menu takes', async () => {
    const outcome = await runAction('command.run', { command: 'project.new' })

    expect(outcome).toEqual({ ok: true })
    expect(createPicked).toHaveBeenCalled()
  })

  // The three the main process performs itself never reach the window, so there is nothing here
  // to run — and saying so is better than reporting a fullscreen that never happened.
  it('still refuses the commands the main process fires on its own', async () => {
    const outcome = await runAction('command.run', { command: 'window.fullScreen' })

    expect(outcome).toEqual({ ok: false, refusal: 'globalCommand' })
  })
})

describe('choosing and preparing a model', () => {
  it('arms a model for its family', async () => {
    expect(await runAction('models.select', { family: 'image', modelId: 'model_x' })).toEqual({
      ok: true,
    })

    expect(useModels.getState().selected.image).toBe('model_x')
  })

  it('fills the generator without sending anything', async () => {
    await runAction('generator.prepare', {
      family: '3d',
      modelId: 'model_y',
      parameters: { prompt: 'a knight helmet' },
    })

    expect(useModels.getState().preset['3d']).toEqual({ prompt: 'a knight helmet' })
    expect(useModels.getState().selected['3d']).toBe('model_y')
  })

  it('refuses parameters that are not a set of values', async () => {
    const outcome = await runAction('generator.prepare', {
      family: '3d',
      modelId: 'model_y',
      parameters: 'a knight helmet',
    })

    expect(outcome).toEqual({ ok: false, refusal: 'badInput' })
  })

  it('searches the catalogue and answers what it found', async () => {
    installFakeBridge({
      scenario: {
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
      data: { jobId: 'job_1' },
    })
    expect(submit).toHaveBeenCalled()
    stop()
  })

  it('opens the generator, and refuses, when no panel is mounted', async () => {
    const outcome = await runAction('generator.submit', {})

    expect(outcome).toEqual({ ok: false, refusal: 'generatorClosed' })
    expect(revealTool).toHaveBeenCalledWith('generator')
  })

  it('refuses when the panel is up but nothing is armed', async () => {
    const stop = registerGenerator(aGenerator({ body: () => null }))

    expect(await runAction('generator.submit', {})).toEqual({
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
    installFakeBridge({ scenario: { suggestPrompts } })
    const stop = registerGenerator(aGenerator({ body: () => ({ modelId: 'model_x', values: {} }) }))

    const outcome = await runAction('prompt.suggest', { draft: 'un chevalier' })

    expect(suggestPrompts).toHaveBeenCalledWith({ modelId: 'model_x', prompt: 'un chevalier' })
    expect(outcome).toEqual({ ok: true, data: [{ text: 'a knight', parameters: {} }] })
    stop()
  })

  // Suggestions are written FOR a model, so there is no useful answer without one armed.
  it('refuses to suggest with no model armed', async () => {
    installFakeBridge()

    expect(await runAction('prompt.suggest', { draft: 'un chevalier' })).toEqual({
      ok: false,
      refusal: 'generatorClosed',
    })
  })

  it('translates what it was handed, and says which language it recognised', async () => {
    installFakeBridge({
      scenario: {
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
    installFakeBridge({ scenario: { describeStyle } })
    const stop = registerGenerator(aGenerator({ references: () => ['asset_1'] }))

    const outcome = await runAction('prompt.describeStyle', {})

    expect(describeStyle).toHaveBeenCalledWith(['asset_1'])
    expect(outcome).toEqual({ ok: true, data: { description: 'flat', synthesis: '' } })
    stop()
  })

  it('says there is nothing to read rather than asking about an empty list', async () => {
    installFakeBridge()
    const stop = registerGenerator(aGenerator())

    expect(await runAction('prompt.describeStyle', {})).toEqual({
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
    const ask = vi.fn(() => Promise.resolve(true))
    const stop = registerConfirmer(ask)

    await runConfirmedAction('workspace.open', { workspace: '3d' })

    expect(ask).not.toHaveBeenCalled()
    expect(showWorkspace).toHaveBeenCalledWith('3d')
    stop()
  })

  it('asks before spending, and quotes what the form would cost', async () => {
    const ask = vi.fn(() => Promise.resolve(true))
    const submit = vi.fn(() => Promise.resolve(aJob('job_1')))
    installFakeBridge({
      scenario: { estimateCost: () => Promise.resolve({ creativeUnits: 4 }) },
    })
    const stopGenerator = registerGenerator(
      aGenerator({ body: () => ({ modelId: 'model_x', values: { prompt: 'a knight' } }), submit }),
    )
    const stopConfirmer = registerConfirmer(ask)

    await runConfirmedAction('generator.submit', {})

    expect(ask).toHaveBeenCalledWith({
      action: 'generator.submit',
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
    const stopConfirmer = registerConfirmer(() => Promise.resolve(false))

    expect(await runConfirmedAction('generator.submit', {})).toEqual({
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

    expect(await runConfirmedAction('generator.submit', {})).toEqual({
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
      scenario: { estimateCost: () => Promise.resolve({ creativeUnits: 4 }) },
    })
    const stopGenerator = registerGenerator(
      aGenerator({ body: () => ({ modelId: 'model_x', values: { count } }), submit }),
    )
    // The hand that changes the form while the question is on screen.
    const stopConfirmer = registerConfirmer(() => {
      count = 10
      return Promise.resolve(true)
    })

    expect(await runConfirmedAction('generator.submit', {})).toEqual({
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
    const ask = vi.fn(() => Promise.resolve(false))
    const stop = registerConfirmer(ask)

    await runConfirmedAction('command.run', { command: 'canvas.cutout' })

    expect(ask).toHaveBeenCalledWith({ action: 'command.run', commitment: 'asset' })
    stop()
  })

  it('says the estimate is unknown rather than inventing one', async () => {
    const ask = vi.fn(() => Promise.resolve(false))
    installFakeBridge({ scenario: { estimateCost: () => Promise.reject(new Error('no price')) } })
    const stopGenerator = registerGenerator(aGenerator())
    const stopConfirmer = registerConfirmer(ask)

    await runConfirmedAction('generator.submit', {})

    expect(ask).toHaveBeenCalledWith({
      action: 'generator.submit',
      commitment: 'credits',
      estimate: null,
    })
    stopGenerator()
    stopConfirmer()
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

    expect(await runConfirmedAction('workspace.open', { workspace: 'nowhere' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(await runConfirmedAction('workspace.open', { worksapce: '3d' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(showWorkspace).not.toHaveBeenCalled()
  })

  // A costly action with a bad input must not raise the question first: the person would be
  // asked to approve a spend that was never going to happen.
  it('is refused without anybody being asked', async () => {
    const ask = vi.fn(async () => true)
    const stop = registerConfirmer(ask)

    expect(await runConfirmedAction('generator.submit', { unexpected: 1 })).toEqual({
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
    expect(commitmentOfCall('command.run', { command: 'canvas.cutout' })).toBe('asset')
    expect(commitmentOfCall('command.run', { command: 'canvas.zoomIn' })).toBe('none')
  })
})
