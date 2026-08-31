import { cloudOfModelId } from '@shared/domain/codeGeneration'
import { isTripoModelId } from '@shared/domain/tripo'
import type { JobRunner } from '@main/provider/jobManager'
import type { CodeJobRunner } from './codeJobRunner'
import type { LocalJobRunner } from './localJobRunner'

/**
 * One runner in front of four, so `JobManager` keeps knowing about exactly one.
 *
 * ADR-21 as amended: the panel never switches "to the cloud" — a model is chosen, and the model
 * knows where it runs. This is where that sentence becomes routing, and it reads the TARGET on
 * every call: a job resumed from a previous session carries an id its runner has never seen, so
 * routing a poll by id would have sent it to whichever runner happened to remember one.
 */
export type RoutedJobDeps = {
  local: LocalJobRunner
  /** The chat clouds, which write scripts and file nothing. */
  code: CodeJobRunner
  /** The second cloud that generates, or nothing when no key is held for it. */
  tripo: () => JobRunner | null
  /** The cloud's own runner, or nothing when no account is held for it. */
  cloud: () => JobRunner | null
  isLocalTarget: (targetId: string) => boolean
}

export function createRoutedJobRunner(deps: RoutedJobDeps): JobRunner {
  // Rejected rather than thrown: `JobManager` awaits these, and a synchronous throw from a
  // submission would escape the retry that is meant to word the failure.
  const required = async (runner: JobRunner | null): Promise<JobRunner> => {
    if (!runner) throw new Error('no account is held for a generation that needs one')

    return runner
  }

  /** Which of the four owns a target, decided by the target alone. */
  const routed = async (targetId: string): Promise<JobRunner> => {
    if (cloudOfModelId(targetId) !== null) return deps.code
    if (isTripoModelId(targetId)) return await required(deps.tripo())
    if (deps.isLocalTarget(targetId)) return deps.local

    return await required(deps.cloud())
  }

  return {
    submit: async (target, body) => await (await routed(target.id)).submit(target, body),

    poll: async (jobId, target) => await (await routed(target.id)).poll(jobId, target),

    cancel: async (jobId, target) => {
      await (await routed(target.id)).cancel(jobId, target)
    },
  }
}
