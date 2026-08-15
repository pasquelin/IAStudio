import { describe, expect, it, vi } from 'vitest'
import { ACTION_REGISTRY, INSTRUCTION_MAX } from '@shared/domain/assistant'
import type { Job } from '@shared/domain/job'
import { createAssetText } from './asset-text'
import { createScenarioBrain } from './brain-scenario'
import { actionCatalogue, instructionFor, preambleLength, recentHistory } from './instruction'
import { jsonIn, parseReply } from './reply'

const succeeded = (assetIds: string[] = ['asset_reply'], cost = 0.75): Job => ({
  id: 'job_1',
  targetId: 'model_scenario-llm',
  label: 'Assistant',
  status: 'succeeded',
  progress: 1,
  createdAt: '2026-08-15T10:00:00.000Z',
  assetIds,
  cost,
})

describe('what the model is told', () => {
  it('names every action of the registry', () => {
    const catalogue = actionCatalogue()

    for (const action of ACTION_REGISTRY) expect(catalogue).toContain(action.name)
  })

  // The values a field closes over are the difference between a workspace that opens and one the
  // model invented. Left out, `workspace.open` is a name with no idea what to put in it.
  it('spells out the values a closed field accepts', () => {
    expect(actionCatalogue()).toContain('one of: image, video, 3d, audio, textures, skyboxes')
  })

  it('says what each action is for, in English, from the bundle', () => {
    expect(actionCatalogue()).toContain('Switches to a workspace')
  })

  /**
   * The budget is what stops a long paste from being answered with a 400. It falls on the
   * sentence, never on the instructions: trimming the end would take off the very thing being
   * answered and leave the catalogue whole.
   */
  it('cuts an over-long sentence rather than the instructions', () => {
    const instruction = instructionFor('x'.repeat(INSTRUCTION_MAX * 2))

    expect(instruction.length).toBe(INSTRUCTION_MAX)
    expect(instruction).toContain('Catalogue:')
    expect(instruction).toContain('workspace.open')
  })

  // The one thing that could quietly eat the budget is an action added with a florid
  // description. Half is a wide margin; it is at about a fifth today.
  it('leaves most of the budget to what the person actually said', () => {
    expect(preambleLength()).toBeLessThan(INSTRUCTION_MAX / 2)
  })

  it('keeps the last turns, not the first', () => {
    expect(recentHistory(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd'])
  })
})

describe('reading what came back', () => {
  it('takes a bare object', () => {
    expect(parseReply('{"say":"hello","calls":[]}')).toEqual({ say: 'hello', calls: [] })
  })

  /**
   * Measured behaviour of the cheapest model on the list, not pessimism: it wraps the object in
   * a fence and a sentence about as often as not. Recovering it costs four lines; refusing it
   * costs a round trip and a creative unit.
   */
  it('recovers an object the model wrapped in prose or a fence', () => {
    const wrapped = 'Here you go:\n```json\n{"say":"ok","calls":[]}\n```\nHope that helps!'

    expect(parseReply(wrapped)).toEqual({ say: 'ok', calls: [] })
  })

  it('reads a call the registry declares', () => {
    const text = '{"say":"","calls":[{"action":"workspace.open","input":{"workspace":"3d"}}]}'

    expect(parseReply(text)).toEqual({
      say: '',
      calls: [{ action: 'workspace.open', input: { workspace: '3d' } }],
    })
  })

  /**
   * Refused whole rather than filtered down to the calls that are real. Dropping the unknown one
   * silently would run the remainder of a plan its author meant to run entire — the studio would
   * do half of something nobody asked for.
   */
  it('refuses the whole reply when one call names nothing', () => {
    const text =
      '{"say":"","calls":[{"action":"workspace.open","input":{"workspace":"3d"}},' +
      '{"action":"workspace.destroy","input":{}}]}'

    expect(parseReply(text)).toBeNull()
  })

  it('refuses anything that is not an object', () => {
    expect(parseReply('sorry, I cannot help with that')).toBeNull()
    expect(parseReply('[1,2,3]')).toBeNull()
    expect(parseReply('')).toBeNull()
  })

  // Shape answered, nothing said, nothing done — which is not an answer a person can be shown.
  it('refuses a reply that neither speaks nor acts', () => {
    expect(parseReply('{"say":"","calls":[]}')).toBeNull()
  })

  it('takes an action with no input at all', () => {
    expect(parseReply('{"say":"","calls":[{"action":"jobs.list"}]}')).toEqual({
      say: '',
      calls: [{ action: 'jobs.list', input: {} }],
    })
  })

  it('finds no object where there is none', () => {
    expect(jsonIn('nothing here')).toBeNull()
  })
})

describe('reading the asset the model wrote', () => {
  it('takes the preview when it is the whole text, without downloading', async () => {
    const download = vi.fn(() => Promise.resolve('never asked for'))
    const readText = createAssetText({
      retrieve: () =>
        Promise.resolve({
          url: 'https://cdn/asset',
          properties: { preview: '{"say":"ok"}', hasFullPreview: true },
        }),
      download,
    })

    expect(await readText('asset_1')).toBe('{"say":"ok"}')
    expect(download).not.toHaveBeenCalled()
  })

  /**
   * A truncated preview is the worst of the three outcomes: parsed as JSON it fails halfway
   * through an object that was complete on the server, and the retry pays for a fault that was
   * never the model's.
   */
  it('downloads when the preview is only part of the answer', async () => {
    const readText = createAssetText({
      retrieve: () =>
        Promise.resolve({
          url: 'https://cdn/asset',
          properties: { preview: '{"say":"ok', hasFullPreview: false },
        }),
      download: () => Promise.resolve('{"say":"ok","calls":[]}'),
    })

    expect(await readText('asset_1')).toBe('{"say":"ok","calls":[]}')
  })

  it('answers nothing when there is nowhere to read from', async () => {
    const readText = createAssetText({
      retrieve: () => Promise.resolve({}),
      download: () => Promise.resolve('unreachable'),
    })

    expect(await readText('asset_1')).toBe('')
  })
})

describe('thinking', () => {
  it('answers the reply and what it cost', async () => {
    const brain = createScenarioBrain({
      run: () => Promise.resolve(succeeded()),
      readText: () => Promise.resolve('{"say":"Opening.","calls":[]}'),
      model: () => 'claude-haiku-4-5',
    })

    expect(await brain.think({ utterance: 'open a 3D file', history: [] })).toEqual({
      reply: { say: 'Opening.', calls: [] },
      cost: 0.75,
    })
  })

  it('sends the history as text inputs, capped at what the API takes', async () => {
    const run = vi.fn((_body: Record<string, unknown>) => Promise.resolve(succeeded()))
    const brain = createScenarioBrain({
      run,
      readText: () => Promise.resolve('{"say":"ok","calls":[]}'),
      model: () => 'claude-haiku-4-5',
    })

    const history = Array.from({ length: 25 }, (_, index) => `turn ${index}`)
    await brain.think({ utterance: 'and now?', history })

    const body = run.mock.calls[0]?.[0]
    expect(body?.textInputs).toHaveLength(10)
    expect((body?.textInputs as string[]).at(-1)).toBe('turn 24')
    expect(body?.model).toBe('claude-haiku-4-5')
  })

  /**
   * One retry, and only one: a model that cannot answer the shape twice will not answer it the
   * third time, and every attempt is a creative unit off the person's balance. The answer is
   * quoted back because a model told only "that was not JSON" tends to send the same thing again.
   */
  it('asks once more, quoting the fault, and charges for both', async () => {
    const answers = ['I think you want a 3D file!', '{"say":"Opening.","calls":[]}']
    const run = vi.fn((_body: Record<string, unknown>) => Promise.resolve(succeeded()))
    const brain = createScenarioBrain({
      run,
      readText: () => Promise.resolve(answers.shift() ?? ''),
      model: () => 'claude-haiku-4-5',
    })

    const outcome = await brain.think({ utterance: 'open a 3D file', history: [] })

    expect(outcome.reply).toEqual({ say: 'Opening.', calls: [] })
    expect(outcome.cost).toBe(1.5)
    const retry = run.mock.calls[1]?.[0]
    expect((retry?.textInputs as string[]).at(-1)).toContain('I think you want a 3D file!')
  })

  it('gives up after the second, saying nothing rather than throwing', async () => {
    const brain = createScenarioBrain({
      run: () => Promise.resolve(succeeded()),
      readText: () => Promise.resolve('still not JSON'),
      model: () => 'claude-haiku-4-5',
    })

    const outcome = await brain.think({ utterance: 'open a 3D file', history: [] })

    expect(outcome.reply).toEqual({ say: '', calls: [] })
    expect(outcome.cost).toBe(1.5)
  })

  // A job that failed was still paid for, and the total the modal shows has to say so.
  it('counts what a failed job cost', async () => {
    const brain = createScenarioBrain({
      run: () => Promise.resolve({ ...succeeded([], 0.75), status: 'failed', error: 'rejected' }),
      readText: () => Promise.resolve(''),
      model: () => 'claude-haiku-4-5',
    })

    expect((await brain.think({ utterance: 'hello', history: [] })).cost).toBe(1.5)
  })

  it('reads no asset when the job produced none', async () => {
    const readText = vi.fn(() => Promise.resolve(''))
    const brain = createScenarioBrain({
      run: () => Promise.resolve(succeeded([])),
      readText,
      model: () => 'claude-haiku-4-5',
    })

    await brain.think({ utterance: 'hello', history: [] })

    expect(readText).not.toHaveBeenCalled()
  })
})
