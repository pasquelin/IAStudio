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
  error: 'the model repeats the reads of its previous round',
}

const callKey = (call: AssistantCall): string => `${call.action}:${JSON.stringify(call.input)}`

/**
 * 🛑 The same reads as the round before, and nothing else: 2.5 ran `files.search` fifteen rounds
 * in a row before the step limit (2026-09-06). Reads only — a read after a mutation is a check.
 */
export function repeatsLastRound(
  mission: Mission,
  step: MissionStep,
  answer: AssistantAnswer,
): boolean {
  if (answer.calls.length === 0) return false
  const before = mission.plan.steps.slice(0, mission.plan.steps.indexOf(step))
  const lastRound = before.slice(before.findLastIndex(one => one.kind !== 'action') + 1)
  const previous = new Set(
    lastRound.flatMap(one =>
      one.kind === 'action' && assistantAction(one.call.action)?.reads ? [callKey(one.call)] : [],
    ),
  )
  return previous.size > 0 && answer.calls.every(call => previous.has(callKey(call)))
}
