import { assistantAction, type AssistantAnswer, type AssistantCall } from '@shared/domain/assistant'
import type { Mission, MissionStep } from '@shared/domain/mission'
import type { MissionStepOutcome } from './scheduler'

// Failed rather than planned as zero steps, which closed the mission « completed » with nothing done.
export const unreadableOutcome: MissionStepOutcome = {
  kind: 'failed',
  error: 'the model answered nothing readable',
}

export const repeatingOutcome: MissionStepOutcome = {
  kind: 'failed',
  error: 'the model repeats the reads or refused calls of its previous round',
}

const callKey = (call: AssistantCall): string => `${call.action}:${JSON.stringify(call.input)}`

const refused = (result: unknown): boolean =>
  typeof result === 'object' && result !== null && 'ok' in result && result.ok === false

/** The rounds before this step, newest first — a round is what one answer of the model planned. */
function completedRounds(mission: Mission, step: MissionStep): readonly (readonly MissionStep[])[] {
  const before = mission.plan.steps
    .slice(
      0,
      mission.plan.steps.findIndex(one => one.id === step.id),
    )
    .filter(one => one.state === 'completed')
  const rounds: MissionStep[][] = []
  let round: MissionStep[] = []
  for (const one of before) {
    if (one.kind === 'action') round.push(one)
    else {
      rounds.push(round)
      round = []
    }
  }
  rounds.push(round)
  return rounds.reverse()
}

const idleKeys = (round: readonly MissionStep[]): ReadonlySet<string> =>
  new Set(
    round.flatMap(one =>
      one.kind === 'action' && (assistantAction(one.call.action)?.reads || refused(one.result))
        ? [callKey(one.call)]
        : [],
    ),
  )

/**
 * 🛑 The same reads, or the same refused calls, as the TWO rounds before and nothing else: 2.5
 * ran `files.search` fifteen rounds in a row, 6.10 sent one refused fold eighteen times
 * (2026-09-06). One repeat is let through — DeepSeek reads twice before it acts, and 9.4 died
 * on that — two are a loop. A mutation that went through is not counted: a read after it checks.
 */
export function repeatsLastRound(
  mission: Mission,
  step: MissionStep,
  answer: AssistantAnswer,
): boolean {
  if (answer.calls.length === 0) return false
  const [last, before] = completedRounds(mission, step)
  if (!last || !before) return false
  const keys = answer.calls.map(callKey)
  const repeats = (round: readonly MissionStep[]): boolean => {
    const idle = idleKeys(round)
    return idle.size > 0 && keys.every(key => idle.has(key))
  }
  return repeats(last) && repeats(before)
}
