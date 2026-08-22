import type { AssetCollector } from '@main/provider/jobManager'

/**
 * One collector in front of two, so `JobManager` keeps knowing about exactly one — the same shape
 * `createRoutedJobRunner` gives the runners, and for the same reason: the model knows where it
 * runs, and a job id says which of the two owns what it produced.
 */
export type RoutedCollectorDeps = {
  local: AssetCollector
  /** The cloud's own collector, or nothing when no account is held for it. */
  cloud: () => AssetCollector | null
  owns: (jobId: string) => boolean
}

export function createRoutedCollector(deps: RoutedCollectorDeps): AssetCollector {
  return async (job, remoteAssetIds) => {
    if (deps.owns(job.id)) return await deps.local(job, remoteAssetIds)

    const cloud = deps.cloud()
    // A cloud job whose account went away between the run and the collection: its outputs exist
    // and nothing here can fetch them, which is a storage failure and reads as one.
    if (!cloud) throw new Error('no account is held for the outputs of this generation')

    return await cloud(job, remoteAssetIds)
  }
}
