import type { Mission, MissionStep } from '@shared/domain/mission'
import type { ContextBudgetReport } from './context'
import { CONTEXT_BUDGETS } from './contextBudget'
import { compactContextValue, serializedContextLength } from './contextCompaction'

type ResultsRequest = { mission: Mission; step: MissionStep }

const textWithin = (text: string, maximum: number): string =>
  text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`

const RESULT_ROOM = 600

/** The steps of the round that just ran: what the current step is about to build on. */
function lastRoundIds(input: ResultsRequest): ReadonlySet<string> {
  const steps = input.mission.plan.steps
  const before = steps.slice(
    0,
    steps.findIndex(step => step.id === input.step.id),
  )
  const opened = before.findLastIndex(step => step.kind === 'reason' || step.kind === 'verify')
  return new Set(before.slice(opened + 1).map(step => step.id))
}

/**
 * 🛑 What the model did, WITH the call: shown `files.search → []` five times without the query,
 * it searched again with the same words, fifteen rounds in a row (2.5, 2026-09-06). Its own
 * `say` is not a result and is left out; the newest come first, since the cut takes the tail.
 * The round that just ran gets the room: cut to 600 characters, a `scene.state` lost the very
 * transform the model had read it for, and it read again — which the repeat guard then killed.
 */
export function previousResults(input: ResultsRequest, report: ContextBudgetReport) {
  const latest = lastRoundIds(input)
  let left = CONTEXT_BUDGETS.results.maxCharacters
  return input.mission.plan.steps
    .filter(
      step =>
        step.state === 'completed' &&
        step.id !== input.step.id &&
        step.kind !== 'reason' &&
        step.kind !== 'verify' &&
        (step.kind === 'action' || step.result !== undefined),
    )
    .reverse()
    .map(step => {
      const room = latest.has(step.id) ? Math.max(RESULT_ROOM, left - RESULT_ROOM) : RESULT_ROOM
      const result = compactContextValue(step.result, room)
      if (result.truncated || step.title.length > 160)
        report.results = { ...report.results, truncated: true, contentTruncated: true }
      const entry = {
        stepId: step.id,
        title: textWithin(step.title, 160),
        ...(step.kind === 'action' ? { call: step.call } : {}),
        result: result.value,
      }
      left -= serializedContextLength(entry)
      return entry
    })
    .sort(
      (left, right) =>
        Number(input.step.dependsOn.includes(right.stepId)) -
        Number(input.step.dependsOn.includes(left.stepId)),
    )
}
