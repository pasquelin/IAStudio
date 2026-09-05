import {
  ACTION_RESOURCES,
  ACTION_REGISTRY,
  assistantAction,
  type ActionOutcome,
  type ActionResource,
  type AssistantAnswer,
  type AssistantCall,
} from '@shared/domain/assistant'
import type { Job } from '@shared/domain/job'
import {
  addMissionStep,
  createMissionStep,
  isMissionFinished,
  recoverInterruptedMission,
  type Mission,
  type MissionClock,
  type MissionStepDraft,
} from '@shared/domain/mission'
import { refToString, type Ref } from '@shared/domain/ref'
import type { AssistantBrain } from '@main/assistant/brainPort'
import type { RemoteActions } from '@main/mcp/asking'
import type { JobManager } from '@main/provider/jobManager'
import type { AssistantContextBuilder } from './contextBuilder'
import type { MissionMetrics } from './metrics'
import type { MissionManager, MissionScope } from './manager'
import {
  createMissionScheduler,
  type MissionRevisionCheck,
  type MissionRevisionReader,
  type MissionScheduler,
  type MissionStepOutcome,
} from './scheduler'

export type MissionRuntime = {
  create: (goal: string, scope: MissionScope) => Promise<Mission>
  start: () => Promise<void>
  scheduler: MissionScheduler
}

type RuntimeDeps = {
  manager: MissionManager
  context: AssistantContextBuilder
  brain: AssistantBrain
  actions: RemoteActions
  jobs: Pick<JobManager, 'list'>
  revisions: MissionRevisionReader
  clock: MissionClock
  metrics?: MissionMetrics
}

type PlannedStep = { title: string; draft: MissionStepDraft }

const contextText = (context: Awaited<ReturnType<AssistantContextBuilder['build']>>): string => {
  const compact = {
    ...context,
    actions: context.actions.map(hit => ({ name: hit.action.name, score: hit.score })),
  }
  return JSON.stringify(compact, (_key, value: unknown) =>
    value instanceof Uint8Array ? `[${value.byteLength} image bytes]` : value,
  )
}

const actionStep = (call: AssistantCall): PlannedStep => ({
  title: call.action,
  draft: { kind: 'action', call },
})

const reasoningStep = (): PlannedStep => ({ title: 'Continue mission', draft: { kind: 'reason' } })

const verificationStep = (): PlannedStep => ({
  title: 'Verify mission result',
  draft: { kind: 'verify' },
})

const MAX_MISSION_STEPS = 48

type ReferenceRefusal = {
  ok: false
  refusal: 'untrustedReference'
  field: string
  given: string
  validReferences: readonly string[]
}

function referenceValues(value: unknown, key: string): readonly string[] {
  if (Array.isArray(value)) return value.flatMap(item => referenceValues(item, key))
  if (typeof value !== 'object' || value === null) return []
  const reference = Object.entries(value).find(([entryKey]) => entryKey === key)?.[1]
  return typeof reference === 'string' ? [reference] : []
}

function referencesReturned(
  mission: Mission,
  resource: ActionResource,
): { authoritative: boolean; values: readonly string[] } {
  const steps = mission.plan.steps.filter(
    step =>
      step.kind === 'action' &&
      step.state === 'completed' &&
      (assistantAction(step.call.action)?.returns ?? []).includes(resource),
  )
  const reference = ACTION_RESOURCES[resource].reference
  return {
    authoritative: steps.length > 0,
    values: reference
      ? [...new Set(steps.flatMap(step => referenceValues(step.result, reference.key)))]
      : [],
  }
}

function resourceAvailable(mission: Mission, resource: ActionResource): boolean {
  return mission.plan.steps.some(step => {
    if (step.kind !== 'action' || step.state !== 'completed') return false
    const descriptor = assistantAction(step.call.action)
    if (descriptor?.produces?.includes(resource)) return true
    if (!descriptor?.returns?.includes(resource)) return false
    return Array.isArray(step.result)
      ? step.result.length > 0
      : step.result !== undefined && step.result !== null
  })
}

function missingResources(
  mission: Mission,
  step: Extract<Mission['plan']['steps'][number], { kind: 'action' }>,
): readonly ActionResource[] {
  const descriptor = assistantAction(step.call.action)
  return [...(descriptor?.requires ?? []), ...(descriptor?.inputs ?? [])].filter(
    resource => !resourceAvailable(mission, resource),
  )
}

function referenceRefusal(
  mission: Mission,
  step: Extract<Mission['plan']['steps'][number], { kind: 'action' }>,
): ReferenceRefusal | null {
  const descriptor = assistantAction(step.call.action)
  if (!descriptor) return null
  for (const field of descriptor.fields) {
    if (!field.reference || typeof step.call.input[field.key] !== 'string') continue
    const resources = [...(descriptor.inputs ?? []), ...(descriptor.uses ?? [])].filter(
      resource => ACTION_RESOURCES[resource].reference?.kind === field.reference,
    )
    const returned = resources.map(resource => referencesReturned(mission, resource))
    if (!returned.some(result => result.authoritative)) continue
    const validReferences = [...new Set(returned.flatMap(result => result.values))]
    const given = step.call.input[field.key]
    if (typeof given === 'string' && !validReferences.includes(given)) {
      return {
        ok: false,
        refusal: 'untrustedReference',
        field: field.key,
        given,
        validReferences,
      }
    }
  }
  return null
}

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

function nextStepAfter(call: AssistantCall | undefined): PlannedStep {
  const descriptor = call ? assistantAction(call.action) : null
  const continues = [...(descriptor?.produces ?? []), ...(descriptor?.returns ?? [])].some(
    resource =>
      ACTION_REGISTRY.some(
        action => action.inputs?.includes(resource) || action.requires?.includes(resource),
      ),
  )
  return continues ? reasoningStep() : verificationStep()
}

function plannedFrom(
  answer: AssistantAnswer,
  verification: boolean,
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
  if (actions.length === 0) return verification ? [] : actions
  const next = nextStepAfter(answer.calls.at(-1))
  return verificationPlanned && next.draft.kind === 'verify' ? actions : [...actions, next]
}

function hasDependentVerification(mission: Mission, stepId: string): boolean {
  return mission.plan.steps.some(
    step => step.kind === 'verify' && step.state === 'pending' && step.dependsOn.includes(stepId),
  )
}

const jobIdOf = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null || !('jobId' in value)) return null
  return typeof value.jobId === 'string' ? value.jobId : null
}

const terminalJob = (jobs: readonly Job[], jobId: string): Job | null => {
  const job = jobs.find(candidate => candidate.id === jobId)
  return job && job.status !== 'queued' && job.status !== 'running' ? job : null
}

function missingResourceOutcome(missing: readonly ActionResource[]): MissionStepOutcome {
  return {
    kind: 'planned',
    result: {
      ok: false,
      refusal: 'missingResources',
      resources: missing,
      producers: ACTION_REGISTRY.filter(action =>
        missing.some(
          resource => action.produces?.includes(resource) || action.returns?.includes(resource),
        ),
      ).map(action => action.name),
    },
    steps: [reasoningStep()],
  }
}

function refusedActionOutcome(
  step: Extract<Mission['plan']['steps'][number], { kind: 'action' }>,
  outcome: Extract<ActionOutcome, { ok: false }>,
): MissionStepOutcome {
  return outcome.refusal === 'badInput' || outcome.refusal === 'notFound'
    ? {
        kind: 'planned',
        result: { ...outcome, action: step.call.action, input: step.call.input },
        steps: [reasoningStep()],
      }
    : { kind: 'failed', error: `action ${step.call.action}: ${outcome.refusal}` }
}

export function createMissionRuntime(deps: RuntimeDeps): MissionRuntime {
  const buildContext = async (
    mission: Mission,
    step: Mission['plan']['steps'][number],
    visual = false,
  ): ReturnType<AssistantContextBuilder['build']> => {
    const context = await deps.context.build({ mission, step, request: mission.goal, visual })
    if (context.document) {
      const resource: Ref = { kind: 'document', id: context.document.id }
      if (!mission.resourceRefs.some(ref => refToString(ref) === refToString(resource))) {
        await deps.manager.update(mission.id, mission.revision, current => ({
          ...current,
          resourceRefs: [...current.resourceRefs, resource],
        }))
      }
    }
    return context
  }

  const think = async (
    mission: Mission,
    step: Mission['plan']['steps'][number],
    signal: AbortSignal,
    utterance: string,
  ): Promise<AssistantAnswer> => {
    const capabilities = await deps.brain.capabilities()
    const visualRequest =
      /\b(inspect|look at|compare visually|visual appearance|inspecte|regarde|compare visuellement|apparence visuelle)\b/iu
    const wantsVisual =
      capabilities.multimodalImages && visualRequest.test(`${mission.goal} ${step.title}`)
    const context = await buildContext(mission, step, wantsVisual)
    const serialized = contextText(context)
    deps.metrics?.context(context, serialized.length)
    deps.metrics?.llmCall(step.kind === 'reason')
    return await deps.brain.think(
      {
        utterance,
        history: [],
        context: serialized,
        candidates: context.actions.map(hit => hit.action.name),
        images: context.visual?.map(({ mimeType, bytes }) => ({ mimeType, bytes })),
      },
      { signal },
    )
  }

  const runAction = async (
    mission: Mission,
    step: Extract<Mission['plan']['steps'][number], { kind: 'action' }>,
    signal: AbortSignal,
    revision: MissionRevisionCheck,
  ): Promise<MissionStepOutcome> => {
    const context = await buildContext(mission, step)
    if (mission.projectId && context.project?.path !== mission.projectId) {
      return {
        kind: 'waiting',
        wait: { kind: 'recovery', stepId: step.id, reason: 'scope_unavailable' },
      }
    }
    if (revision.decision === 'reconsider') {
      deps.metrics?.replan()
      const answer = await think(
        mission,
        step,
        signal,
        `Re-evaluate this action after the document changed: ${JSON.stringify(step.call)}`,
      )
      return {
        kind: 'planned',
        result: { say: answer.say, ask: answer.ask },
        steps: plannedFrom(answer, true, hasDependentVerification(mission, step.id)),
      }
    }
    const missing = missingResources(mission, step)
    if (missing.length > 0) return missingResourceOutcome(missing)
    const refused = referenceRefusal(mission, step)
    if (refused) {
      return { kind: 'planned', result: refused, steps: [reasoningStep()] }
    }
    const outcome = await deps.actions.run(step.call, signal)
    if (!outcome.ok) return refusedActionOutcome(step, outcome)
    const jobId = jobIdOf(outcome.data)
    return jobId
      ? {
          kind: 'planned',
          result: outcome.data,
          steps: [{ title: `Wait for ${jobId}`, draft: { kind: 'job', jobId } }],
        }
      : { kind: 'completed', result: outcome.data }
  }

  const passiveOutcome = (
    step: Mission['plan']['steps'][number],
    revision: MissionRevisionCheck,
  ): MissionStepOutcome | null => {
    if (step.kind === 'user_input') {
      if (!revision.resumed) deps.metrics?.wait('user')
      return revision.resumed
        ? { kind: 'completed' }
        : { kind: 'waiting', wait: { kind: 'user', stepId: step.id } }
    }
    if (step.kind === 'job') {
      const job = terminalJob(deps.jobs.list(), step.jobId)
      if (!job) {
        deps.metrics?.wait('job')
        return { kind: 'waiting', wait: { kind: 'job', stepId: step.id, jobId: step.jobId } }
      }
      return job.status === 'succeeded'
        ? { kind: 'completed', result: job }
        : { kind: 'failed', error: `job ${job.id} ${job.status}` }
    }
    return step.kind === 'sub_mission'
      ? {
          kind: 'waiting',
          wait: { kind: 'dependency', stepId: step.id, missionId: step.childMissionId },
        }
      : null
  }

  const runner = async (
    step: Mission['plan']['steps'][number],
    signal: AbortSignal,
    revision: MissionRevisionCheck,
  ): Promise<MissionStepOutcome> => {
    const mission = await deps.manager.read(step.missionId)
    if (!mission) return { kind: 'failed', error: `mission ${step.missionId} disappeared` }
    if (revision.decision === 'reconsider') deps.metrics?.revisionConflict()
    const passive = passiveOutcome(step, revision)
    if (passive) return passive
    if (step.kind === 'action') return await runAction(mission, step, signal, revision)
    if (mission.plan.steps.length >= MAX_MISSION_STEPS) {
      return { kind: 'failed', error: 'mission step limit reached' }
    }
    const answer = await think(
      mission,
      step,
      signal,
      step.kind === 'verify'
        ? `Verify whether this mission is complete from the current state: ${mission.goal}`
        : mission.goal,
    )
    const steps = plannedFrom(
      answer,
      step.kind === 'verify',
      hasDependentVerification(mission, step.id),
    )
    if (mission.plan.steps.length + steps.length > MAX_MISSION_STEPS) {
      return { kind: 'failed', error: 'mission step limit reached' }
    }
    deps.metrics?.plannedSteps(steps.length)
    return {
      kind: 'planned',
      result: { say: answer.say, ask: answer.ask },
      steps,
    }
  }

  const scheduler = createMissionScheduler(deps.manager, runner, deps.clock, 2, deps.revisions)
  return {
    scheduler,
    start: async () => {
      for (const mission of await deps.manager.list({})) {
        if (isMissionFinished(mission.state)) continue
        const recovered = recoverInterruptedMission(mission, deps.clock.now())
        if (recovered !== mission) {
          await deps.manager.update(mission.id, mission.revision, () => recovered)
        }
        if (recovered.state !== 'paused') await scheduler.wake(recovered.id)
      }
    },
    create: async (goal, scope) => {
      const mission = await deps.manager.create(goal, scope)
      const activeMissions = (await deps.manager.list(scope)).filter(
        candidate => !isMissionFinished(candidate.state),
      ).length
      deps.metrics?.concurrency(activeMissions)
      const planned = await deps.manager.update(mission.id, mission.revision, current =>
        addMissionStep(
          current,
          createMissionStep(current.id, 'Plan mission', { kind: 'reason' }, deps.clock),
          deps.clock.now(),
        ),
      )
      await scheduler.wake(planned.id)
      return (await deps.manager.read(planned.id)) ?? planned
    },
  }
}
