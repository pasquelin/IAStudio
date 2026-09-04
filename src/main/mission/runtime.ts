import type { AssistantAnswer, AssistantCall } from '@shared/domain/assistant'
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

function plannedFrom(answer: AssistantAnswer, verification: boolean): readonly PlannedStep[] {
  if (answer.ask) {
    return [
      {
        title: answer.ask.questions.map(question => question.question).join('\n'),
        draft: { kind: 'user_input' },
      },
      reasoningStep(),
    ]
  }
  const actions = answer.calls.map(actionStep)
  return actions.length > 0 ? [...actions, verificationStep()] : verification ? [] : actions
}

const jobIdOf = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null || !('jobId' in value)) return null
  return typeof value.jobId === 'string' ? value.jobId : null
}

const terminalJob = (jobs: readonly Job[], jobId: string): Job | null => {
  const job = jobs.find(candidate => candidate.id === jobId)
  return job && job.status !== 'queued' && job.status !== 'running' ? job : null
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
        steps: plannedFrom(answer, true),
      }
    }
    const outcome = await deps.actions.run(step.call, signal)
    if (!outcome.ok) {
      return { kind: 'failed', error: `action ${step.call.action}: ${outcome.refusal}` }
    }
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
    const steps = plannedFrom(answer, step.kind === 'verify')
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
