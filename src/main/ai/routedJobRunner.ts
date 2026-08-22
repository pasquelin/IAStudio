import type { JobRunner } from '@main/provider/jobManager'
import type { LocalJobRunner } from './localJobRunner'

/**
 * One runner in front of two, so `JobManager` keeps knowing about exactly one.
 *
 * ADR-21 as amended: the panel never switches "to the cloud" — a model is chosen, and the model
 * knows where it runs. This is where that sentence becomes routing: a target on this machine goes
 * to the local runner, and a job id says which of the two owns the poll that follows.
 */
export type RoutedJobDeps = {
  local: LocalJobRunner
  /** The cloud's own runner, or nothing when no account is held for it. */
  cloud: () => JobRunner | null
  isLocalTarget: (targetId: string) => boolean
}

export function createRoutedJobRunner(deps: RoutedJobDeps): JobRunner {
  // Rejected rather than thrown: `JobManager` awaits these, and a synchronous throw from a
  // submission would escape the retry that is meant to word the failure.
  const cloud = async (): Promise<JobRunner> => {
    const runner = deps.cloud()
    if (!runner) throw new Error('no account is held for a generation that needs one')

    return runner
  }

  return {
    submit: async (target, body) =>
      deps.isLocalTarget(target.id)
        ? await deps.local.submit(target, body)
        : await (await cloud()).submit(target, body),

    poll: async jobId =>
      deps.local.owns(jobId) ? await deps.local.poll(jobId) : await (await cloud()).poll(jobId),

    cancel: async jobId => {
      if (deps.local.owns(jobId)) return await deps.local.cancel(jobId)

      await (await cloud()).cancel(jobId)
    },
  }
}
