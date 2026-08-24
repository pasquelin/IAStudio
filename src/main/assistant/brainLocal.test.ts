import { describe, expect, it } from 'vitest'
import type { ChatRequest } from '@main/ai/localRuntimes'
import { createLocalBrain } from './brainLocal'

const brainAnswering = (answers: readonly string[], contextTokens = 8192) => {
  const asked: ChatRequest[] = []
  let turn = 0

  const chat = (request: ChatRequest) => {
    asked.push(request)
    return Promise.resolve(answers[turn++] ?? '')
  }

  return {
    brain: createLocalBrain({ chat, modelId: 'llama3.2:3b', contextTokens }),
    asked,
  }
}

const briefingOf = (asked: readonly ChatRequest[]): string =>
  String(asked[0]?.messages.find(turn => turn.role === 'system')?.content)

const REPLY = '{"say":"Opening it.","calls":[]}'

describe('the local brain', () => {
  it('reads the answer the model wrote', async () => {
    const { brain } = brainAnswering([REPLY])

    await expect(brain.think({ utterance: 'open the 3d space', history: [] })).resolves.toEqual({
      say: 'Opening it.',
      calls: [],
      cost: 0,
    })
  })

  /**
   * What a local model is shown follows from ITS window and from nothing else — the same
   * arithmetic that decides how much history fits. A three-billion model on eight thousand
   * tokens gets the short list; one with a hundred and thirty thousand gets the registry.
   */
  it('is shown the whole registry when its window holds it', async () => {
    const { brain, asked } = brainAnswering([REPLY], 131_072)

    await brain.think({ utterance: 'hello', history: [] })

    expect(briefingOf(asked)).toContain('  git.checkout —')
  })

  it('is shown the short list, and the way to ask for the rest, in a small window', async () => {
    const { brain, asked } = brainAnswering([REPLY])

    await brain.think({ utterance: 'hello', history: [] })

    expect(briefingOf(asked)).not.toContain('  git.checkout —')
    expect(briefingOf(asked)).toContain('"actions.find"')
  })

  /**
   * 🛑 The channel takes ten thousand characters and this window holds a third of that. An uncut
   * paste does not overflow itself: the runtime cuts from the HEAD, where the briefing sits, so
   * the loss lands on the instructions rather than on the paste — ADR-18.
   */
  it('cuts a long paste to its own window, leaving the briefing whole', async () => {
    // 4 096, which is what every Ollama model of the catalogue declares.
    const { brain, asked } = brainAnswering([REPLY], 4_096)

    await brain.think({ utterance: 'x'.repeat(10_000), history: [] })

    const said = String(asked[0]?.messages.at(-1)?.content)
    expect(said.length).toBeLessThan(10_000)
    expect(briefingOf(asked)).toContain('Catalogue:')
  })

  it('asks the model for one JSON object, in the window its manifest declares', async () => {
    const { brain, asked } = brainAnswering([REPLY])

    await brain.think({ utterance: 'hello', history: [] })

    expect(asked[0]).toMatchObject({ model: 'llama3.2:3b', contextTokens: 8192, json: true })
  })

  /**
   * 🛑 The catalogue goes in a `system` turn and the sentence just typed is the LAST turn. Burying
   * it in the briefing had the model answer the turn before it — the cloud door does not have this
   * failure, because there the instruction is a field beside the inputs rather than one turn.
   */
  it('puts the briefing first and the sentence last', async () => {
    const { brain, asked } = brainAnswering([REPLY])

    await brain.think({ utterance: 'open the 3d space', history: ['earlier'] })

    const messages = asked[0]?.messages ?? []
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).not.toContain('open the 3d space')
    expect(messages.slice(1)).toEqual([
      { role: 'user', content: 'earlier' },
      { role: 'user', content: 'open the 3d space' },
    ])
  })

  /**
   * 🛑 A runtime that overruns its window truncates silently and cuts from the HEAD, where the
   * preamble sits — ADR-18. The oldest turns are dropped HERE so the loss is ours to choose.
   */
  it('drops the oldest turns rather than letting the runtime eat the preamble', async () => {
    const { brain, asked } = brainAnswering([REPLY])

    await brain.think({ utterance: 'hello', history: ['x'.repeat(30_000), 'recent'] })

    expect(asked[0]?.messages.slice(1)).toEqual([
      { role: 'user', content: 'recent' },
      { role: 'user', content: 'hello' },
    ])
  })

  // The same one retry the cloud brain gets, and for the same reason: a model told only "that was
  // not JSON" tends to produce the same thing again, so it is shown what it sent.
  it('asks once more, quoting back what could not be read', async () => {
    const { brain, asked } = brainAnswering(['I would love to help!', REPLY])

    await expect(brain.think({ utterance: 'hello', history: [] })).resolves.toMatchObject({
      say: 'Opening it.',
    })
    expect(asked).toHaveLength(2)
    expect(JSON.stringify(asked[1]?.messages)).toContain('I would love to help!')
  })

  /**
   * Invariant 6: a turn run in this process generates to its ceiling, and a window closed
   * mid-answer would leave it running with nobody to read it. The signal is what stops it, and it
   * has to reach the runtime — not merely be accepted at the top.
   */
  it('hands the runtime what stops a turn nobody is waiting for any more', async () => {
    const { brain, asked } = brainAnswering([REPLY])
    const abort = new AbortController()

    await brain.think({ utterance: 'hello', history: [] }, abort.signal)

    expect(asked[0]?.signal).toBe(abort.signal)
  })

  // A person is waiting, and "I did not understand" beats a stack trace.
  it('says nothing rather than raising when two attempts are both unreadable', async () => {
    const { brain } = brainAnswering(['nope', 'still nope'])

    await expect(brain.think({ utterance: 'hello', history: [] })).resolves.toEqual({
      say: '',
      calls: [],
      cost: 0,
    })
  })
})
