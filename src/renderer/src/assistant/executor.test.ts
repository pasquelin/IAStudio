import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Job } from '@shared/domain/job'
import type { ModelSummary } from '@shared/domain/model'
import { installFakeBridge } from '@/services/fake-bridge'
import { subscribeToCommands } from '@/services/command-bus'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useJobs } from '@/stores/jobs'
import { registerGenerator } from './generator-bridge'
import { commitmentOfCall } from '@shared/domain/assistant'
import { registerConfirmer } from './confirm'
import { runAction, runConfirmedAction } from './executor'

const showWorkspace = vi.hoisted(() => vi.fn())
const createDocumentIn = vi.hoisted(() => vi.fn())
const revealTool = vi.hoisted(() => vi.fn())

vi.mock('@/app/dockview-api', () => ({ showWorkspace }))
vi.mock('@/app/new-document', () => ({ createDocumentIn }))
vi.mock('@/helpers/reveal-panel', () => ({ revealTool }))

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

const aJob = (id: string): Job => ({
  id,
  targetId: 'model_x',
  label: 'Knight',
  status: 'running',
  progress: 0.5,
  createdAt: '2026-08-15T10:00:00.000Z',
  assetIds: [],
})

beforeEach(() => {
  vi.clearAllMocks()
  installFakeBridge()
  onImageDocument()
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

  it('refuses a command nothing declares', async () => {
    const outcome = await runAction('command.run', { command: 'canvas.summonADragon' })

    expect(outcome).toEqual({ ok: false, refusal: 'unknownCommand' })
  })

  it('refuses the menu’s own commands, which Electron fires itself', async () => {
    const outcome = await runAction('command.run', { command: 'document.save' })

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
    const stop = registerGenerator({ body: () => ({ modelId: 'm', values: {} }), submit })

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
    const stop = registerGenerator({ body: () => null, submit: () => Promise.resolve(null) })

    expect(await runAction('generator.submit', {})).toEqual({
      ok: false,
      refusal: 'nothingPrepared',
    })
    stop()
  })
})

describe('listing the jobs', () => {
  it('answers what the studio is tracking', async () => {
    useJobs.setState({ jobs: [aJob('job_1')] })

    expect(await runAction('jobs.list', {})).toEqual({
      ok: true,
      data: [{ id: 'job_1', label: 'Knight', status: 'running', progress: 0.5 }],
    })
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
    const stopGenerator = registerGenerator({
      body: () => ({ modelId: 'model_x', values: { prompt: 'a knight' } }),
      submit,
    })
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
    const stopGenerator = registerGenerator({
      body: () => ({ modelId: 'model_x', values: {} }),
      submit,
    })
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
    const stop = registerGenerator({ body: () => ({ modelId: 'm', values: {} }), submit })

    expect(await runConfirmedAction('generator.submit', {})).toEqual({
      ok: false,
      refusal: 'noConfirmer',
    })
    expect(submit).not.toHaveBeenCalled()
    stop()
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
    const stopGenerator = registerGenerator({
      body: () => ({ modelId: 'm', values: {} }),
      submit: () => Promise.resolve(null),
    })
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
