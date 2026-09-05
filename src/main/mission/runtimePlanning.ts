import {
  ACTION_REGISTRY,
  assistantAction,
  type ActionResource,
  type AssistantAnswer,
  type AssistantCall,
} from '@shared/domain/assistant'
import type { Mission, MissionStepDraft } from '@shared/domain/mission'

export type PlannedStep = { title: string; draft: MissionStepDraft }

const actionStep = (call: AssistantCall): PlannedStep => ({
  title: call.action,
  draft: { kind: 'action', call },
})

export const reasoningStep = (): PlannedStep => ({
  title: 'Continue mission',
  draft: { kind: 'reason' },
})

export const verificationStep = (): PlannedStep => ({
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
 * 🛑 A READ never ends a mission: asked to « verify » right after `files.search`, the model
 * answered « the duplicate was created » about a duplicate nobody made — seven scenarios of the
 * first thirty-five (2026-09-06). What engages nothing is followed by planning, never by a check.
 */
function nextStepAfter(call: AssistantCall | undefined): PlannedStep {
  const descriptor = call ? assistantAction(call.action) : null
  if (descriptor?.commitment === 'none') return reasoningStep()
  const continues = [...(descriptor?.produces ?? []), ...(descriptor?.returns ?? [])].some(
    resource =>
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
  for (const call of answer.calls) {
    const descriptor = assistantAction(call.action)
    if ((descriptor?.inputs ?? []).some(resource => dependsOnReturned(resource, returned))) {
      return [...actions, reasoningStep()]
    }
    actions.push(actionStep(call))
    for (const resource of descriptor?.returns ?? []) returned.add(resource)
  }
  if (actions.length === 0) return []
  const next = nextStepAfter(answer.calls.at(-1))
  return verificationPlanned && next.draft.kind === 'verify' ? actions : [...actions, next]
}

export function hasDependentVerification(mission: Mission, stepId: string): boolean {
  return mission.plan.steps.some(
    step => step.kind === 'verify' && step.state === 'pending' && step.dependsOn.includes(stepId),
  )
}
