import type { ActionName } from '@shared/domain/assistant'
import { composedContext } from '@shared/domain/projectContext'
import { useAssistant } from '@/stores/assistant'
import { PROJECT } from './project'
import type { Called, Run, Scenario } from './run'
import { createStudio, type Think } from './studio'

/**
 * 🛑 `useAssistant.say()` chains the rounds — the window's own loop, so the ceiling, the history
 * window and the stop conditions are the ones the product ships. The bench stands in for the
 * DOOR the main process holds, filling state and context as `createRoutedBrain` does.
 */
export async function play(scenario: Scenario, ask: Think): Promise<Run & { rounds: number }> {
  const asked: { action: ActionName; input: Record<string, unknown> }[] = []
  let rounds = 0

  const studio = await createStudio(PROJECT, async request => {
    rounds += 1
    const answer = await ask({
      ...request,
      state: await studio.state(),
      context: composedContext(studio.shell.context().cards),
    })

    asked.push(...answer.calls.map(one => ({ action: one.action as ActionName, input: one.input })))
    return answer
  })

  await scenario.setup?.(studio)
  // What the decor changed is not what the model changed — see `settle`.
  studio.settle()
  useAssistant.setState({ turns: [], spent: 0 })

  for (const said of scenario.said) await useAssistant.getState().say(said)

  const turns = useAssistant.getState().turns
  const steps = turns.flatMap(one => one.steps)
  /**
   * 🛑 Paired by INDEX and then closed: `ranAll` returns early on a stop and on a throw, so the
   * calls it never reached are in `asked` with no step behind them — zipping two lists would
   * read the wrong answer for every call after the first gap.
   */
  const called: Called[] = asked.map((one, at) => {
    const step = steps[at]
    return step === undefined || step.action !== one.action
      ? one
      : { ...one, answer: answerShown(step) }
  })

  return {
    studio,
    called,
    refused: steps.filter(one => one.refusal !== null).length,
    said: turns.map(one => one.answered).join('\n'),
    asks: turns.flatMap(one => one.asks.map(asked => asked.question)),
    rounds,
  }
}

/**
 * What the studio answered, as the model was shown it: a refusal by name, or how much came back.
 * The COUNT and not the rows — "found 0" is the whole finding, and nine paths are three lines.
 */
function answerShown(step: { refusal: string | null; detail?: string; data?: unknown }): string {
  if (step.refusal !== null) {
    return `refused ${step.refusal}${step.detail === undefined ? '' : ` (${step.detail})`}`
  }
  if (Array.isArray(step.data)) return `found ${step.data.length}`

  return step.data === undefined ? 'ok' : `ok ${shortly(step.data)}`
}

/** What a value was, short enough to read in a failure list. */
export const shortly = (value: unknown): string => {
  const written = typeof value === 'string' ? value : JSON.stringify(value)
  return written.length > 60 ? `${written.slice(0, 57)}…` : written
}
