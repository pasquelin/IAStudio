import type { ActionName } from '@shared/domain/assistant'
import type { MissionState } from '@shared/domain/mission'
import type { Called } from './run'

/**
 * Why one failed run failed, read off what the runtime recorded — never off the model's words.
 * One class per run, the first that applies, from the cheapest to tell apart to the vaguest.
 */
export type MissionFailureClass =
  | 'runtime-failed'
  | 'question-asked'
  | 'no-call'
  | 'expected-outside-candidates'
  | 'expected-not-called'
  | 'refused'
  | 'duplicate-call'
  | 'oracle'

export type MissionFailureEvidence = {
  /** What `coverage.ts` says the scenario exercises. */
  expected: readonly ActionName[]
  /** Every candidate any reflection of the run showed the model. */
  candidates: ReadonlySet<ActionName>
  called: readonly Called[]
  missionStates: readonly MissionState[]
}

const callKey = (call: Called): string => `${call.action}:${JSON.stringify(call.input)}`

/**
 * 🛑 What `coverage.ts` expects of the LEGACY chain and the runtime does by itself: a `jobId`
 * answered by an action becomes a `job` step, so the wait is never a call the model makes.
 */
const RUNTIME_HANDLED: ReadonlySet<ActionName> = new Set(['job.waitForCloudGeneration'])

export function missionFailureClassOf(evidence: MissionFailureEvidence): MissionFailureClass {
  if (evidence.missionStates.includes('failed')) return 'runtime-failed'
  if (evidence.missionStates.includes('waiting_user')) return 'question-asked'
  if (evidence.called.length === 0) return 'no-call'
  const called = new Set(evidence.called.map(call => call.action))
  const uncalled = evidence.expected.filter(
    action => !called.has(action) && !RUNTIME_HANDLED.has(action),
  )
  if (uncalled.some(action => !evidence.candidates.has(action))) {
    return 'expected-outside-candidates'
  }
  if (uncalled.length > 0) return 'expected-not-called'
  if (evidence.called.some(call => call.answer?.startsWith('refused'))) return 'refused'
  const keys = evidence.called.map(callKey)
  if (new Set(keys).size < keys.length) return 'duplicate-call'
  return 'oracle'
}
