import { afterAll, describe, expect, it } from 'vitest'
import { assistantStepsWithin } from '@shared/domain/assistantSteps'
import { CLOUD_PROVIDERS, defaultChatModel } from '@shared/domain/aiCloud'
import { orElse } from '@shared/promises'
import { isRecord } from '@shared/guards'
import type { ActionName } from '@shared/domain/assistant'
import { assistantHistory, type AssistantTurn } from '@/assistant/conversation'
import { createHttpChatBrain } from '@main/assistant/brainHttp'
import { PROJECT, SCENARIOS, type Run, type Scenario } from './scenarios'
import { createFakeStudio } from './fakeStudio'

/**
 * The bench: a REAL model, over the real request path, against a studio that only answers.
 *
 * What it measures is the one thing a suite cannot — whether the model CHOOSES the right actions
 * on a request a person actually typed. Everything it fixes was found on a screenshot until now,
 * and every prompt written to fix one was a bet nobody could settle.
 *
 * Out of `pnpm validate` on purpose: it costs money, needs a key, and answers differently twice
 * in a row. A gate has to be none of those.
 */
const KEY = process.env['EVAL_KEY'] ?? ''

/**
 * 🛑 How many times each scenario is played, because ONE play measures nothing: the same code
 * scored 60% and then 40% two minutes apart, on the same five scenarios. A model is not a
 * function, and a bench that reads it as one reports noise as progress.
 */
const RUNS = Math.max(1, Math.trunc(Number(process.env['EVAL_RUNS'] ?? 3)) || 1)
const PROVIDER = process.env['EVAL_PROVIDER'] ?? 'deepseek'

/**
 * 🛑 A door this bench can speak to, which Scenario is not: its chat crosses an account and a
 * secret rather than a bare HTTP key, and `ask` has no arm for it. Named rather than left to fail
 * on a 400 nobody can read.
 */
const cloud = CLOUD_PROVIDERS.find(one => one.id === PROVIDER)
const chat = cloud && cloud.chat.kind !== 'scenario' ? cloud.chat : null
const MODEL = process.env['EVAL_MODEL'] ?? defaultChatModel(PROVIDER) ?? ''

type Measured = {
  name: string
  passed: number
  of: number
  rounds: number
  refused: number
} & Tokens

/**
 * What a turn actually costs, which `cost` cannot say: that field counts Scenario's creative
 * units, and every other cloud bills tokens. Read off the answer's own `usage`, so it is the
 * figure the invoice is made of rather than one this file computed.
 */
type Tokens = { sent: number; back: number; cached: number }

const NOTHING: Tokens = { sent: 0, back: 0, cached: 0 }

/** Counts what crossed, and hands the response on untouched. */
function counting(into: Tokens): (input: string, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const answer = await fetch(input, init)
    // A proxy answering HTML on a 401 or a 502 is not a fault of this counter's making, and a
    // parse error here would abort the run before the code below could report the real one.
    const body: unknown = await orElse(answer.clone().json(), null)
    const usage = isRecord(body) && isRecord(body['usage']) ? body['usage'] : {}
    const read = (key: string): number => (typeof usage[key] === 'number' ? usage[key] : 0)

    // Three spellings for one figure: OpenAI and its compatibles, Anthropic, and Gemini. Read
    // from one of them only, every count stays 0 and the report divides by it.
    const nested = isRecord(body) && isRecord(body['usageMetadata']) ? body['usageMetadata'] : {}
    const from = (of: Record<string, unknown>, key: string): number =>
      typeof of[key] === 'number' ? of[key] : 0

    into.sent += read('prompt_tokens') + read('input_tokens') + from(nested, 'promptTokenCount')
    into.back +=
      read('completion_tokens') + read('output_tokens') + from(nested, 'candidatesTokenCount')
    // What the door served from its own cache — the figure the next lot is about.
    into.cached += read('prompt_cache_hit_tokens') + read('cache_read_input_tokens')
    return answer
  }
}

const measured: Measured[] = []

/** Actions no scenario modelled — every figure below is worth less for each one of them. */
const unmodelled: ActionName[] = []

const sumOf = (read: (one: Measured) => number): number =>
  measured.reduce((total, one) => total + read(one), 0)

/** Everything a chain of rounds spends, run against one scenario. */
async function play(scenario: Scenario): Promise<Run & { rounds: number } & Tokens> {
  const studio = createFakeStudio(PROJECT)
  const tokens: Tokens = { ...NOTHING }
  const brain = createHttpChatBrain({
    chat: chat ?? { kind: 'openai', baseUrl: '', model: '' },
    credentials: () => ({ key: KEY, secret: '' }),
    model: () => MODEL,
    fetch: counting(tokens),
  })

  const turn: AssistantTurn = { id: 1, said: scenario.said, answered: '', steps: [], lost: false }
  const called: { action: ActionName; input: Record<string, unknown> }[] = []
  let refused = 0
  let rounds = 0

  for (let round = 1; round <= assistantStepsWithin(8); round += 1) {
    rounds = round
    const answer = await brain.think({
      utterance: scenario.said,
      continuing: round > 1,
      history: round === 1 ? [] : assistantHistory([turn]),
      state: studio.state(),
      // The app passes these on every round; without them the bench's briefing is not the app's.
      targets: [],
    })

    turn.answered = turn.answered ? `${turn.answered}\n${answer.say}` : answer.say
    if (answer.calls.length === 0) break

    for (const call of answer.calls) {
      const outcome = studio.run(call.action, call.input)
      called.push({ action: call.action as ActionName, input: call.input })
      if (!outcome.ok) refused += 1
      turn.steps = [
        ...turn.steps,
        {
          action: call.action,
          refusal: outcome.ok ? null : outcome.refusal,
          ...(outcome.ok && outcome.data !== undefined ? { data: outcome.data } : {}),
        },
      ]
    }
  }

  return { studio, called, refused, said: turn.answered, rounds, ...tokens }
}

describe.skipIf(KEY === '' || chat === null)(`what ${PROVIDER} does with a real request`, () => {
  it.each(SCENARIOS)('$name', { timeout: 600_000 }, async scenario => {
    const tally: Measured = {
      name: scenario.name,
      passed: 0,
      of: RUNS,
      rounds: 0,
      refused: 0,
      ...NOTHING,
    }
    const missed: string[] = []

    for (let run = 0; run < RUNS; run += 1) {
      const played = await play(scenario)
      tally.rounds += played.rounds
      tally.refused += played.refused
      tally.sent += played.sent
      tally.back += played.back
      tally.cached += played.cached

      // What it CHOSE is the whole finding: a bare `false` sends the reader back to spend the
      // same money again to learn what this line already holds.
      if (scenario.passed(played)) tally.passed += 1
      else missed.push(`${played.called.map(one => one.action).join(' → ') || 'no call'}`)

      // 🛑 A step this bench has no answer for is a verdict it has not earned: the model may
      // have done the right thing and been scored on a studio that did nothing. Named on the
      // spot rather than left in the total.
      for (const action of played.studio.unmodelled()) {
        if (!unmodelled.includes(action)) unmodelled.push(action)
      }
    }

    measured.push(tally)
    expect(tally.passed, missed.join('\n  ')).toBe(RUNS)
  })

  afterAll(() => {
    if (measured.length === 0) return

    const rate = sumOf(one => one.passed) / sumOf(one => one.of)

    console.log(`\n  ${PROVIDER} — ${MODEL}, ${RUNS} runs each`)
    for (const one of measured) {
      console.log(
        `  ${one.passed === one.of ? '✓' : '✗'} ${one.name} — ${one.passed}/${one.of} passed, ` +
          `${(one.rounds / one.of).toFixed(1)} rounds, ` +
          `${one.refused} refused, ${one.sent} sent (${one.cached} cached), ${one.back} back`,
      )
    }
    const sent = sumOf(one => one.sent)
    if (unmodelled.length > 0) {
      console.log(`\n  🛑 not modelled, so scored blind: ${unmodelled.join(', ')}`)
    }

    console.log(
      `\n  passed ${Math.round(rate * 100)}% · ${sumOf(one => one.rounds)} rounds · ` +
        `${sumOf(one => one.refused)} refused · ${Math.round(sent / sumOf(one => one.rounds))} ` +
        `tokens a round, ${Math.round((sumOf(one => one.cached) / sent) * 100)}% of them cached\n`,
    )
  })
})
