import { runnerIdOf } from '@shared/domain/job'
import type { AssetCollector } from '@main/provider/jobManager'

export type RoutedCollectorDeps = {
  local: AssetCollector
  /** The cloud's own collector, or nothing when no account is held for it. */
  cloud: () => AssetCollector | null
  owns: (jobId: string) => boolean
}

/**
 * One collector in front of two, so `JobManager` keeps knowing about exactly one. A job id
 * says which of the two owns what it produced — the same split `createRoutedJobRunner` uses.
 */
export function createRoutedCollector(deps: RoutedCollectorDeps): AssetCollector {
  return async (job, remoteAssetIds) => {
    if (deps.owns(runnerIdOf(job))) return await deps.local(job, remoteAssetIds)

    const cloud = deps.cloud()
    // A cloud job whose account went away between the run and the collection: its outputs exist
    // and nothing here can fetch them, which is a storage failure and reads as one.
    if (!cloud) throw new Error('no account is held for the outputs of this generation')

    return await cloud(job, remoteAssetIds)
  }
}
