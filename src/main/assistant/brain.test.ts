import { describe, expect, it, vi } from 'vitest'
import { ACTION_REGISTRY, actionsReaching, type ActionName } from '@shared/domain/assistant'
import { CONTEXT_COMPOSED_MAX } from '@shared/domain/projectContext'
import type { Job } from '@shared/domain/job'
import { createAssetText } from './assetText'
import {
  BRIEFING_ROOM,
  createProviderBrain,
  INSTRUCTION_MAX,
  UTTERANCE_ROOM,
} from './brainProvider'
import { recentHistory, studioBriefing } from './instruction'
import { STATE_MAX } from './studioState'
import type { AssistantNote } from '@shared/domain/assistantNote'
import { answeredTurn } from './brainTurn'
import { jsonIn, parseReply } from './reply'

/** What the short list shows, which is what an answer to it is held to. */
const SHOWN: ReadonlySet<ActionName> = new Set(actionsReaching('both').map(action => action.name))

/** The briefing this door actually composes: too narrow for the whole registry, by design. */
const shortBriefing = (context = ''): string =>
  studioBriefing({ context, room: BRIEFING_ROOM }).text

/** The instruction one turn of the Scenario door sends, sentence included. */
async function instructionSent(utterance: string, context = '', state = ''): Promise<string> {
  const run = vi.fn((_body: Record<string, unknown>) => Promise.resolve(succeeded()))
  const brain = createProviderBrain({
    run,
    readText: () => Promise.resolve('{"say":"ok","calls":[]}'),
    model: () => 'claude-haiku-4-5',
  })
  await brain.think({ utterance, history: [], context, state })

  return String(run.mock.calls[0]?.[0]?.['instruction'])
}

/**
 * 🛑 This door answers through a JOB, which is BILLED and outlives the ask: the stop reaches it
 * only if the signal travels all the way down to `JobManager.run`, which cancels by id.
 */
describe('stopping a turn on the Scenario door', () => {
  it('hands the job the signal that ends it', async () => {
    const run = vi.fn((_body: Record<string, unknown>, _signal?: AbortSignal) =>
      Promise.resolve(succeeded()),
    )
    const brain = createProviderBrain({
      run,
      readText: () => Promise.resolve('{"say":"ok","calls":[]}'),
      model: () => 'claude-haiku-4-5',
    })
    const stopping = new AbortController()

    await brain.think({ utterance: 'hello', history: [] }, { signal: stopping.signal })

    expect(run.mock.calls[0]?.[1]).toBe(stopping.signal)
  })

  /**
   * 🛑 A cancelled job answers no text, and an empty answer is UNREADABLE — so the turn asked the
   * door a SECOND time, billing a second job for a sentence nobody was waiting for, and the
   * window then called the turn lost rather than stopped.
   */
  it('asks nothing more once the job came back cancelled', async () => {
    const cancelled: Job = { ...succeeded(), status: 'cancelled' }
    const run = vi.fn((_body: Record<string, unknown>, _signal?: AbortSignal) =>
      Promise.resolve(cancelled),
    )
    const brain = createProviderBrain({
      run,
      readText: () => Promise.resolve(''),
      model: () => 'claude-haiku-4-5',
    })

    await expect(brain.think({ utterance: 'hello', history: [] })).rejects.toThrow()
    expect(run).toHaveBeenCalledTimes(1)
  })
})

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
    const briefing = shortBriefing()

    for (const action of ACTION_REGISTRY) {
      // `actions.find` is the exception, and it is spelled by a RULE instead: a block describing
      // the call a rule already writes out whole costs 165 characters of the sentence's room.
      const listed = action.reach === 'both' && action.name !== 'actions.find'
      expect(briefing.includes(`  ${action.name} —`), action.name).toBe(listed)
    }
  })

  // The values a field closes over are the difference between a workspace that opens and one the
  // model invented. Left out, `workspace.open` is a name with no idea what to put in it.
  it('spells out the values a closed field accepts', () => {
    expect(shortBriefing()).toContain('one of: image, video, 3d, code, audio, materials, skyboxes')
  })

  it('says what each action is for, in English, from the bundle', () => {
    expect(shortBriefing()).toContain('Switches to a workspace')
  })

  /**
   * The budget is what stops a long paste from being answered with a 400. It falls on the
   * sentence, never on the instructions: trimming the end would take off the very thing being
   * answered and leave the catalogue whole.
   */
  it('cuts an over-long sentence rather than the instructions', async () => {
    const instruction = await instructionSent('x'.repeat(INSTRUCTION_MAX * 2))

    expect(instruction.length).toBe(INSTRUCTION_MAX)
    expect(instruction).toContain('Catalogue:')
    expect(instruction).toContain('workspace.open')
  })

  /**
   * Stated as what is LEFT rather than as what the preamble costs, because that is the property
   * that matters and the other one moved: 5 110 characters on 2026-08-15, **5 915 on 2026-08-25**,
   * most of it `command.run` enumerating a hundred command ids — which is what makes it usable.
   *
   * The floor was four thousand, then two, and is 1 500 — `UTTERANCE_ROOM` says which, so this
   * reads the constant rather than a number to be edited in three places. At 5 915 the four
   * thousand left EIGHTY-FIVE characters free, and a full project context costs 619 — so the
   * context could not have been added at all. The guarantee is unchanged whatever the figure: a
   * long paste is cut, the instructions always arrive whole.
   */
  it('leaves the person’s own sentence room to be long', async () => {
    expect(await instructionSent('x'.repeat(3_000))).toContain('x'.repeat(UTTERANCE_ROOM))
  })

  /** What the model is told about the project it is working in. */
  it('tells the model what the project is about', () => {
    expect(shortBriefing('World: A medieval forest')).toContain('World: A medieval forest')
  })

  /**
   * 🛑 The one that will rougir the day a verbose action joins the catalogue. The context is
   * bounded before it gets here — `composedContext` caps it — so the sentence never pays for it.
   *
   * Measured on the context ALONE: `notReady` lengthens the briefing too, and nothing here bounds
   * how many employments a machine can be short of at once.
   */
  it('leaves that room even under a project context of the full size', async () => {
    const sent = await instructionSent('y'.repeat(3_000), 'x'.repeat(CONTEXT_COMPOSED_MAX))

    expect(sent).toContain('y'.repeat(UTTERANCE_ROOM))
  })

  /**
   * 🛑 The WORST case, and the guard that has to move whenever a new block joins the preamble.
   * The state block was the newcomer: it is composed from titles and node names a person chose,
   * and the floor below is what the sentence keeps once the context AND the state are both full.
   */
  it('leaves that room with a full project context AND a full state block', async () => {
    const sent = await instructionSent(
      'y'.repeat(3_000),
      'x'.repeat(CONTEXT_COMPOSED_MAX),
      'z'.repeat(STATE_MAX),
    )

    expect(sent).toContain('y'.repeat(UTTERANCE_ROOM))
  })

  it('keeps the last turns, not the first', () => {
    expect(recentHistory(['a', 'b', 'c', 'd'], 2)).toEqual(['c', 'd'])
  })
})

describe('what a turn writes down', () => {
  /**
   * 🛑 The WHOLE briefing travels on the note: it is what the transcript file exists to keep, and
   * clipping it here would leave the one place it survives holding a head.
   */
  it('carries the whole briefing, not a head of it', async () => {
    const notes: AssistantNote[] = []
    // Past the whole registry, so the briefing is the 90 000-character one.
    const briefing = studioBriefing({ room: 200_000 })

    await answeredTurn(
      briefing,
      () => Promise.resolve({ answer: '{"say":"ok","calls":[]}', cost: 0 }),
      undefined,
      { door: 'deepseek', note: one => notes.push(one) },
    )

    expect(notes.find(one => one.kind === 'sent')?.text).toBe(briefing.text)
  })
})

describe('reading what came back', () => {
  it('takes a bare object', () => {
    expect(parseReply('{"say":"hello","calls":[]}', SHOWN)).toEqual({ say: 'hello', calls: [] })
  })

  /**
   * Measured behaviour of the cheapest model on the list, not pessimism: it wraps the object in
   * a fence and a sentence about as often as not. Recovering it costs four lines; refusing it
   * costs a round trip and a creative unit.
   */
  it('recovers an object the model wrapped in prose or a fence', () => {
    const wrapped = 'Here you go:\n```json\n{"say":"ok","calls":[]}\n```\nHope that helps!'

    expect(parseReply(wrapped, SHOWN)).toEqual({ say: 'ok', calls: [] })
  })

  it('reads a call the registry declares', () => {
    const text = '{"say":"","calls":[{"action":"workspace.open","input":{"workspace":"3d"}}]}'

    expect(parseReply(text, SHOWN)).toEqual({
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

    expect(parseReply(text, SHOWN)).toBeNull()
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

    expect(parseReply(text, SHOWN)).toBeNull()
  })

  it('refuses anything that is not an object', () => {
    expect(parseReply('sorry, I cannot help with that', SHOWN)).toBeNull()
    expect(parseReply('[1,2,3]', SHOWN)).toBeNull()
    expect(parseReply('', SHOWN)).toBeNull()
  })

  // Shape answered, nothing said, nothing done — which is not an answer a person can be shown.
  it('refuses a reply that neither speaks nor acts', () => {
    expect(parseReply('{"say":"","calls":[]}', SHOWN)).toBeNull()
  })

  // 🛑 The defect the `ask` key exists for, measured where the rule lives — see `parseReply`.
  it('drops the calls an answer that asks came with', () => {
    const text =
      '{"say":"","ask":{"question":"Quel nom ?","choices":[]},' +
      '"calls":[{"action":"workspace.open","input":{"workspace":"3d"}}]}'

    expect(parseReply(text, SHOWN)).toEqual({
      say: '',
      ask: { question: 'Quel nom ?', choices: [] },
      calls: [],
    })
  })

  // A question is an answer on its own: nothing was said and nothing was done, and the person
  // still has something to read.
  it('takes a question as the whole answer', () => {
    const text = '{"say":"","ask":{"question":"Lequel ?","choices":["a","b"]},"calls":[]}'

    expect(parseReply(text, SHOWN)?.ask).toEqual({ question: 'Lequel ?', choices: ['a', 'b'] })
  })

  /**
   * A button with no words on it is no button, and losing the turn over one teaches nobody
   * anything: the choices are filtered where the QUESTION is what has to be there.
   */
  it('keeps a question whose choices are half empty, and refuses one with no question', () => {
    const half = '{"say":"","ask":{"question":"Lequel ?","choices":["a","",3]},"calls":[]}'
    expect(parseReply(half, SHOWN)?.ask?.choices).toEqual(['a'])

    expect(parseReply('{"say":"ok","ask":{"question":"  "},"calls":[]}', SHOWN)).toEqual({
      say: 'ok',
      calls: [],
    })
  })

  it('takes an action with no input at all', () => {
    expect(parseReply('{"say":"","calls":[{"action":"jobs.list"}]}', SHOWN)).toEqual({
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

  /**
   * Defect 3, on the door that cannot be shown the whole registry: a model that answers with the
   * one question it is allowed gets asked again, with what its query found, and can then act on
   * an action it was never listed. Two round trips, both billed — the price of the narrow door.
   */
  it('asks again with what a query found when the model asks what else there is', async () => {
    const answers = [
      '{"say":"","calls":[{"action":"actions.find","input":{"query":"git branch"}}]}',
      '{"say":"Switching.","calls":[{"action":"git.checkout","input":{"name":"main"}}]}',
    ]
    const run = vi.fn((_body: Record<string, unknown>) => Promise.resolve(succeeded()))
    const brain = createProviderBrain({
      run,
      readText: () => Promise.resolve(answers.shift() ?? ''),
      model: () => 'claude-haiku-4-5',
    })

    const outcome = await brain.think({ utterance: 'switch to main', history: [] })

    expect(outcome).toEqual({
      say: 'Switching.',
      calls: [{ action: 'git.checkout', input: { name: 'main' } }],
      cost: 1.5,
    })
    expect(String(run.mock.calls[1]?.[0]?.['instruction'])).toContain('  git.checkout —')
  })

  /**
   * A plan that finds AND acts was written before the finding, so its other calls are the ones a
   * blind model made. Running them is exactly what asking was supposed to avoid.
   */
  it('does not treat a plan that also acts as a question', async () => {
    const answers = [
      '{"say":"","calls":[{"action":"actions.find","input":{"query":"git"}},' +
        '{"action":"jobs.list","input":{}}]}',
      '{"say":"unreached","calls":[]}',
    ]
    const brain = createProviderBrain({
      run: () => Promise.resolve(succeeded()),
      readText: () => Promise.resolve(answers.shift() ?? ''),
      model: () => 'claude-haiku-4-5',
    })

    expect((await brain.think({ utterance: 'anything', history: [] })).cost).toBe(0.75)
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
