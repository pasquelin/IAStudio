import { cloudOfModelId } from '@shared/domain/codeGeneration'
import type { JobRunner } from '@main/provider/jobManager'
import type { CodeJobRunner } from './codeJobRunner'
import type { LocalJobRunner } from './localJobRunner'

/**
 * One runner in front of three, so `JobManager` keeps knowing about exactly one.
 *
 * ADR-21 as amended: the panel never switches "to the cloud" — a model is chosen, and the model
 * knows where it runs. This is where that sentence becomes routing: a target on this machine goes
 * to the local runner, a `code:<cloud>` one to the chat that writes scripts, and a job id says
 * which of the three owns the poll that follows.
 */
export type RoutedJobDeps = {
  local: LocalJobRunner
  /** The chat clouds, which write scripts and file nothing. */
  code: CodeJobRunner
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
    submit: async (target, body) => {
      if (cloudOfModelId(target.id) !== null) return await deps.code.submit(target, body)
      if (deps.isLocalTarget(target.id)) return await deps.local.submit(target, body)

      return await (await cloud()).submit(target, body)
    },

    poll: async jobId => {
      if (deps.code.owns(jobId)) return await deps.code.poll(jobId)
      if (deps.local.owns(jobId)) return await deps.local.poll(jobId)

      return await (await cloud()).poll(jobId)
    },

    cancel: async jobId => {
      if (deps.code.owns(jobId)) return await deps.code.cancel(jobId)
      if (deps.local.owns(jobId)) return await deps.local.cancel(jobId)

      await (await cloud()).cancel(jobId)
    },
  }
}
