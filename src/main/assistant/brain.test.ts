import { describe, expect, it, vi } from 'vitest'
import { ACTION_REGISTRY, INSTRUCTION_MAX } from '@shared/domain/assistant'
import { CONTEXT_COMPOSED_MAX } from '@shared/domain/projectContext'
import type { Job } from '@shared/domain/job'
import { createAssetText } from './assetText'
import { createProviderBrain } from './brainProvider'
import {
  actionCatalogue,
  instructionFor,
  preambleLength,
  recentHistory,
  studioBriefing,
} from './instruction'
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
  /**
   * The share of the registry a spoken sentence can reach, and NOT the whole of it — the budget
   * below is what forces the split. Both directions, because either miss is silent: an action
   * left out is one the assistant will swear it cannot do, and one let in that reaches `mcp`
   * alone eats the room the person's own sentence needs.
   */
  it('names every action reaching both doors, and none of the others', () => {
    const catalogue = actionCatalogue()

    for (const action of ACTION_REGISTRY) {
      expect(catalogue.includes(`  ${action.name} —`), action.name).toBe(action.reach === 'both')
    }
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
    const instruction = instructionFor('x'.repeat(INSTRUCTION_MAX * 2), [])

    expect(instruction.length).toBe(INSTRUCTION_MAX)
    expect(instruction).toContain('Catalogue:')
    expect(instruction).toContain('workspace.open')
  })

  /**
   * Stated as what is LEFT rather than as what the preamble costs, because that is the property
   * that matters and the other one moved: 5 110 characters on 2026-08-15, **5 915 on 2026-08-25**,
   * most of it `command.run` enumerating a hundred command ids — which is what makes it usable.
   *
   * The floor was four thousand and is two. At 5 915 the old one left EIGHTY-FIVE characters free,
   * and a full project context costs 619 — so the context could not have been added at all, and
   * the case below would have failed at 3 466. Two thousand is some three hundred words, still far
   * past anything anyone says to an assistant, and the guarantee is unchanged: a long paste is
   * cut, the instructions always arrive whole.
   */
  it('leaves the person’s own sentence room to be long', () => {
    expect(INSTRUCTION_MAX - preambleLength([])).toBeGreaterThan(2_000)
  })

  /** What the model is told about the project it is working in. */
  it('tells the model what the project is about', () => {
    expect(studioBriefing([], 'World: A medieval forest')).toContain('World: A medieval forest')
  })

  /**
   * 🛑 The one that will rougir the day a verbose action joins the catalogue. The context is
   * bounded before it gets here — `composedContext` caps it — so the sentence never pays for it.
   *
   * Measured on the context ALONE: `notReady` lengthens the briefing too, and nothing here bounds
   * how many employments a machine can be short of at once.
   */
  it('leaves that room even under a project context of the full size', () => {
    const full = 'x'.repeat(CONTEXT_COMPOSED_MAX)

    expect(INSTRUCTION_MAX - preambleLength([], full)).toBeGreaterThan(2_000)
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
   * Held to the share the model was SHOWN, not to the registry. The catalogue lists it eleven
   * actions; the other seventy-six exist for a program that read `tools/list`. Checking against
   * the whole registry let a name the model had never been given through on its own plausibility
   * — and `git.checkout` rewrites the working tree.
   */
  it('refuses a call naming an action the model was never shown', () => {
    const text = '{"say":"","calls":[{"action":"git.checkout","input":{"name":"main"}}]}'

    expect(parseReply(text)).toBeNull()
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
    const brain = createProviderBrain({
      run: () => Promise.resolve(succeeded()),
      readText: () => Promise.resolve('{"say":"Opening.","calls":[]}'),
      model: () => 'claude-haiku-4-5',
    })

    expect(await brain.think({ utterance: 'open a 3D file', history: [] })).toEqual({
      say: 'Opening.',
      calls: [],
      cost: 0.75,
    })
  })

  it('sends the history as text inputs, capped at what the API takes', async () => {
    const run = vi.fn((_body: Record<string, unknown>) => Promise.resolve(succeeded()))
    const brain = createProviderBrain({
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
    const brain = createProviderBrain({
      run,
      readText: () => Promise.resolve(answers.shift() ?? ''),
      model: () => 'claude-haiku-4-5',
    })

    const outcome = await brain.think({ utterance: 'open a 3D file', history: [] })

    expect(outcome).toEqual({ say: 'Opening.', calls: [], cost: 1.5 })
    const retry = run.mock.calls[1]?.[0]
    expect((retry?.textInputs as string[]).at(-1)).toContain('I think you want a 3D file!')
  })

  it('gives up after the second, saying nothing rather than throwing', async () => {
    const brain = createProviderBrain({
      run: () => Promise.resolve(succeeded()),
      readText: () => Promise.resolve('still not JSON'),
      model: () => 'claude-haiku-4-5',
    })

    const outcome = await brain.think({ utterance: 'open a 3D file', history: [] })

    expect(outcome).toEqual({ say: '', calls: [], cost: 1.5 })
  })

  // A job that failed was still paid for, and the total the modal shows has to say so.
  it('counts what a failed job cost', async () => {
    const brain = createProviderBrain({
      run: () => Promise.resolve({ ...succeeded([], 0.75), status: 'failed', error: 'rejected' }),
      readText: () => Promise.resolve(''),
      model: () => 'claude-haiku-4-5',
    })

    expect((await brain.think({ utterance: 'hello', history: [] })).cost).toBe(1.5)
  })

  it('reads no asset when the job produced none', async () => {
    const readText = vi.fn(() => Promise.resolve(''))
    const brain = createProviderBrain({
      run: () => Promise.resolve(succeeded([])),
      readText,
      model: () => 'claude-haiku-4-5',
    })

    await brain.think({ utterance: 'hello', history: [] })

    expect(readText).not.toHaveBeenCalled()
  })
})
