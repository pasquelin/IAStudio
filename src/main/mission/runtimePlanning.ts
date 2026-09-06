import {
  ACTION_REGISTRY,
  actionReads,
  assistantAction,
  type ActionResource,
  type AssistantAction,
  type AssistantAnswer,
  type AssistantCall,
} from '@shared/domain/assistant'
import type { Mission, MissionStepDraft } from '@shared/domain/mission'

export type PlannedStep = { title: string; draft: MissionStepDraft }

const actionStep = (call: AssistantCall): PlannedStep => ({
  title: call.action,
  draft: { kind: 'action', call },
})

export const reasoningStep = (title = 'Continue mission'): PlannedStep => ({
  title,
  draft: { kind: 'reason' },
})

/**
 * 🛑 A question asked before ANY read: « quel compte ? », « que doit avancer ? » — fourteen of the
 * passe-5 failures asked what a read would have answered (2026-09-06). Held back ONCE per mission,
 * so what only the person knows costs one round more. Within the 160 characters the JSON shows.
 */
export const READ_BEFORE_ASKING =
  'Question NOT sent: nothing was read yet. If a read can answer it, read and act on the answer; if only the person can, ask it again as it was.'

/** Whether an ask is held back: no action ran yet, and the mission was not held back before. */
export function asksBeforeReading(mission: Mission, answer: AssistantAnswer): boolean {
  if (!answer.ask) return false
  const steps = mission.plan.steps
  return (
    !steps.some(step => step.kind === 'action' && step.state === 'completed') &&
    !steps.some(step => step.kind === 'reason' && step.title === READ_BEFORE_ASKING)
  )
}

const verificationStep = (): PlannedStep => ({
  title: 'Verify mission result',
  draft: { kind: 'verify' },
})

function dependsOnReturned(
  resource: ActionResource,
  produced: ReadonlySet<ActionResource>,
  visited: ReadonlySet<ActionResource> = new Set(),
): boolean {
  if (produced.has(resource)) return true
  if (visited.has(resource)) return false
  const nextVisited = new Set(visited).add(resource)
  return ACTION_REGISTRY.filter(action => action.returns?.includes(resource)).some(action =>
    (action.inputs ?? []).some(required => dependsOnReturned(required, produced, nextVisited)),
  )
}

/**
 * 🛑 A read is followed by planning, never by a check — asked to verify after `files.search`, the
 * model invented a duplicate (seven of the first thirty-five, 2026-09-06). A round that mutated is
 * verified even when a read closed it: planned on again bare, the model redid it (6.15, 6.8).
 */
function nextStepAfter(descriptors: readonly (AssistantAction | null)[]): PlannedStep {
  if (descriptors.every(descriptor => descriptor !== null && actionReads(descriptor)))
    return reasoningStep()
  const descriptor = descriptors.at(-1)
  const continues = (descriptor?.produces ?? []).some(resource =>
    ACTION_REGISTRY.some(
      action => action.inputs?.includes(resource) || action.requires?.includes(resource),
    ),
  )
  return continues ? reasoningStep() : verificationStep()
}

export function plannedFrom(
  answer: AssistantAnswer,
  verificationPlanned = false,
): readonly PlannedStep[] {
  if (answer.ask) {
    return [
      {
        title: answer.ask.questions.map(question => question.question).join('\n'),
        draft: { kind: 'user_input' },
      },
      reasoningStep(),
    ]
  }
  const returned = new Set<ActionResource>()
  const actions: PlannedStep[] = []
  const descriptors: (AssistantAction | null)[] = []
  for (const call of answer.calls) {
    const descriptor = assistantAction(call.action)
    descriptors.push(descriptor)
    // `uses` too: a shot the same answer opens is not known yet, one the decor made is.
    const wanted = [...(descriptor?.inputs ?? []), ...(descriptor?.uses ?? [])]
    if (wanted.some(resource => dependsOnReturned(resource, returned))) {
      return [...actions, reasoningStep()]
    }
    actions.push(actionStep(call))
    for (const resource of descriptor?.returns ?? []) returned.add(resource)
  }
  if (actions.length === 0) return []
  const next = nextStepAfter(descriptors)
  return verificationPlanned && next.draft.kind === 'verify' ? actions : [...actions, next]
}

export function hasDependentVerification(mission: Mission, stepId: string): boolean {
  return mission.plan.steps.some(
    step => step.kind === 'verify' && step.state === 'pending' && step.dependsOn.includes(stepId),
  )
}
