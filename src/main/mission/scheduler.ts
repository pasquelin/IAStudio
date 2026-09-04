import {
  isMissionFinished,
  missionCanComplete,
  resolveMissionWait,
  transitionMission,
  transitionMissionStep,
  waitMission,
  type Mission,
  type MissionClock,
  type MissionId,
  type MissionStep,
  type MissionStepId,
  type MissionWaiting,
} from '@shared/domain/mission'
import type { MissionManager } from './manager'
import { writeQueue } from '@main/persistence'

export type MissionStepOutcome =
  | { readonly kind: 'completed'; readonly result?: unknown }
  | { readonly kind: 'waiting'; readonly wait: MissionWaiting }
  | { readonly kind: 'failed'; readonly error: string }

export type MissionStepRunner = (
  step: MissionStep,
  signal: AbortSignal,
) => Promise<MissionStepOutcome>

export type MissionScheduler = {
  wake: (missionId: MissionId) => Promise<void>
  resume: (missionId: MissionId, stepId: MissionStepId) => Promise<void>
  resumeJob: (missionId: MissionId, jobId: string) => Promise<void>
  cancel: (missionId: MissionId) => Promise<void>
}

export function readyMissionSteps(mission: Mission): readonly MissionStep[] {
  return mission.plan.steps.filter(step => {
    if (step.state !== 'pending') return false
    return step.dependsOn.every(id => {
      const dependency = mission.plan.steps.find(candidate => candidate.id === id)
      return dependency?.state === 'completed' || dependency?.state === 'skipped'
    })
  })
}

function activatedMission(mission: Mission, now: string): Mission {
  if (mission.state !== 'created') return mission
  const planning = transitionMission(mission, 'planning', now)
  const ready = transitionMission(planning, 'ready', now)
  return transitionMission(ready, 'running', now)
}

function completedStep(
  mission: Mission,
  stepId: MissionStepId,
  result: unknown,
  now: string,
): Mission {
  const completed = transitionMissionStep(mission, stepId, 'completed', now)
  const withResult = {
    ...completed,
    plan: {
      steps: completed.plan.steps.map(step =>
        step.id === stepId && result !== undefined ? { ...step, result } : step,
      ),
    },
  }
  return missionCanComplete(withResult)
    ? transitionMission(withResult, 'completed', now)
    : withResult
}

function failedStep(mission: Mission, stepId: MissionStepId, error: string, now: string): Mission {
  const failed = transitionMissionStep(mission, stepId, 'failed', now)
  const withError = {
    ...failed,
    plan: {
      steps: failed.plan.steps.map(step => (step.id === stepId ? { ...step, error } : step)),
    },
  }
  return transitionMission(withError, 'failed', now)
}

export function createMissionScheduler(
  manager: MissionManager,
  runner: MissionStepRunner,
  clock: MissionClock,
  concurrency = 2,
): MissionScheduler {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new Error('invalid mission concurrency')
  const controllers = new Map<string, AbortController>()
  const mutations = writeQueue()
  const missionRuns = new Map<MissionId, ReturnType<typeof writeQueue>>()
  const cancelling = new Set<MissionId>()
  let active = 0
  const permits: Array<() => void> = []
  const controllerKey = (missionId: MissionId, stepId: MissionStepId): string =>
    `${missionId}:${stepId}`

  const acquire = async (): Promise<void> => {
    if (active < concurrency) {
      active += 1
      return
    }
    await new Promise<void>(resolve => permits.push(resolve))
  }
  const release = (): void => {
    const next = permits.shift()
    if (next) next()
    else active -= 1
  }
  const update = async (
    missionId: MissionId,
    change: (current: Mission) => Mission | null,
  ): Promise<Mission> =>
    await mutations.next(async () => {
      const current = await manager.read(missionId)
      if (!current) throw new Error(`mission ${missionId} does not exist`)
      const changed = change(current)
      return changed ? await manager.update(missionId, current.revision, () => changed) : current
    })
  const runStep = async (step: MissionStep, signal: AbortSignal): Promise<MissionStepOutcome> => {
    try {
      return await runner(step, signal)
    } catch (error) {
      return { kind: 'failed', error: String(error) }
    }
  }
  const abortMissionSteps = (mission: Mission): void => {
    for (const step of mission.plan.steps) {
      controllers.get(controllerKey(mission.id, step.id))?.abort()
    }
  }
  const applyOutcome = (
    mission: Mission,
    stepId: MissionStepId,
    outcome: MissionStepOutcome,
  ): Mission => {
    if (outcome.kind === 'completed') {
      return completedStep(mission, stepId, outcome.result, clock.now())
    }
    if (outcome.kind === 'waiting') {
      try {
        return waitMission(mission, outcome.wait, clock.now())
      } catch (error) {
        return failedStep(mission, stepId, String(error), clock.now())
      }
    }
    return failedStep(mission, stepId, outcome.error, clock.now())
  }
  const ignoresOutcome = (mission: Mission | null, signal: AbortSignal): boolean =>
    !mission ||
    isMissionFinished(mission.state) ||
    signal.aborted ||
    cancelling.has(mission?.id ?? '')

  const execute = async (missionId: MissionId, stepId: MissionStepId): Promise<void> => {
    await acquire()
    const controller = new AbortController()
    const key = controllerKey(missionId, stepId)
    controllers.set(key, controller)
    try {
      const mission = await manager.read(missionId)
      if (!mission || isMissionFinished(mission.state)) return
      const running = await update(missionId, current =>
        transitionMissionStep(current, stepId, 'running', clock.now()),
      )
      const step = running.plan.steps.find(candidate => candidate.id === stepId)
      if (!step) throw new Error(`mission lost step ${stepId}`)
      let outcome = await runStep(step, controller.signal)
      const current = await manager.read(missionId)
      if (ignoresOutcome(current, controller.signal) || !current) return
      if (outcome.kind === 'waiting' && outcome.wait.stepId !== stepId) {
        outcome = { kind: 'failed', error: `runner wait does not match step ${stepId}` }
      }
      let applied = false
      const changed = await update(current.id, value => {
        const step = value.plan.steps.find(candidate => candidate.id === stepId)
        if (isMissionFinished(value.state) || step?.state !== 'running') return null
        applied = true
        return applyOutcome(value, stepId, outcome)
      })
      if (applied && changed.state === 'failed') abortMissionSteps(changed)
    } finally {
      controllers.delete(key)
      release()
    }
  }

  const runUntilBlocked = async (missionId: MissionId): Promise<void> => {
    let hasWork = true
    while (hasWork) {
      let mission = await manager.read(missionId)
      if (!mission || isMissionFinished(mission.state) || cancelling.has(missionId)) return
      if (mission.state === 'created') {
        mission = await update(mission.id, current => activatedMission(current, clock.now()))
      }
      const pending = readyMissionSteps(mission)
      for (const step of pending) {
        mission = await update(mission.id, current =>
          transitionMissionStep(current, step.id, 'ready', clock.now()),
        )
      }
      const executable = mission.plan.steps.filter(step => step.state === 'ready')
      hasWork = executable.length > 0
      await Promise.all(executable.map(async step => await execute(missionId, step.id)))
    }
  }

  const wake = async (missionId: MissionId): Promise<void> => {
    let queue = missionRuns.get(missionId)
    if (!queue) {
      queue = writeQueue()
      missionRuns.set(missionId, queue)
    }
    await queue.next(async () => await runUntilBlocked(missionId))
  }

  return {
    wake,
    resume: async (missionId, stepId) => {
      const mission = await manager.read(missionId)
      if (!mission) throw new Error(`mission ${missionId} does not exist`)
      await update(mission.id, current => {
        const waiting = current.waits.find(wait => wait.stepId === stepId)
        if (!waiting) return null
        if (waiting.kind !== 'user' && waiting.kind !== 'recovery') {
          throw new Error(`mission step ${stepId} does not wait on the user`)
        }
        return resolveMissionWait(current, stepId, 'ready', clock.now())
      })
      await wake(missionId)
    },
    resumeJob: async (missionId, jobId) => {
      const mission = await manager.read(missionId)
      if (!mission) throw new Error(`mission ${missionId} does not exist`)
      await update(missionId, current => {
        const waiting = current.waits.find(wait => wait.kind === 'job' && wait.jobId === jobId)
        if (waiting) return resolveMissionWait(current, waiting.stepId, 'ready', clock.now())
        const step = current.plan.steps.find(
          candidate => candidate.kind === 'job' && candidate.jobId === jobId,
        )
        if (step && step.state !== 'waiting') return null
        throw new Error(`mission ${missionId} does not wait on job ${jobId}`)
      })
      await wake(missionId)
    },
    cancel: async missionId => {
      cancelling.add(missionId)
      try {
        const mission = await manager.read(missionId)
        if (!mission || isMissionFinished(mission.state)) return
        abortMissionSteps(mission)
        await update(mission.id, current =>
          isMissionFinished(current.state)
            ? null
            : transitionMission(current, 'cancelled', clock.now()),
        )
      } finally {
        cancelling.delete(missionId)
      }
    },
  }
}
