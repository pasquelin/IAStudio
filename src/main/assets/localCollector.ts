import type { AssetType } from '@shared/domain/asset'
import { workspaceOfType } from '@shared/domain/assetKind'
import { generatedAssetName } from '@shared/domain/assetName'
import { extensionOf, pathBaseNameOf } from '@shared/domain/fileName'
import { runnerIdOf } from '@shared/domain/job'
import type { AssetCollector, CollectedOutputs } from '@main/provider/jobManager'
import type { LocalBackend } from './localBackend'

/**
 * What a finished local job left behind. Three fields, not the runner's whole answer: device
 * and backend say what ran it, and nothing here files them.
 */
export type CollectableProduction = {
  readonly path: string
  readonly type: AssetType
  /** What the person typed, which is what names the asset — never the model that answered. */
  readonly prompt: string
}

export type LocalCollectorDeps = {
  /** What this job produced, or `null` for one that produced a sentence rather than a file. */
  producedBy: (jobId: string) => CollectableProduction | null
  /** Removes the hand-off, when there is still one: an import that MOVED the file leaves none. */
  discard: (path: string) => Promise<void>
  backend: LocalBackend
  newId: () => string
  log: (level: 'info' | 'warn', message: string) => void
}

const NOTHING: CollectedOutputs = { ids: [], workspaces: [] }

/**
 * The extension the engine wrote, without its dot — what `WriteRequest` takes. `extensionOf`
 * keeps the dot, so this leans on it rather than respelling the last-dot dance.
 */
function bareExtensionOf(path: string): string {
  return extensionOf(pathBaseNameOf(path)).slice(1) || 'png'
}

/**
 * Brings a generation made on this machine into the project: hand the file the engine wrote to
 * the backend, drop what is left of the hand-off. The cloud collector cannot serve — every branch
 * turns on a remote asset id there is none of.
 */
export function createLocalCollector(deps: LocalCollectorDeps): AssetCollector {
  return async job => {
    const produced = deps.producedBy(runnerIdOf(job))
    // A conversation produced no file: the job succeeded, it simply has nothing to file.
    if (!produced) return NOTHING

    // By PATH, never by bytes: the engine writes video, audio, meshes and panoramas, and reading
    // one to write it back put the whole file through this process's heap for nothing.
    const asset = await deps.backend.importFromFile(
      {
        id: deps.newId(),
        name: generatedAssetName({ prompt: produced.prompt, label: job.label, index: 0, total: 1 }),
        type: produced.type,
        jobId: job.id,
        extension: bareExtensionOf(produced.path),
      },
      produced.path,
    )

    // After the import, never before: the file is in the project, so losing the hand-off costs
    // nothing — where deleting first would lose the generation if the import then failed. A move
    // already took it, and `force` makes that absence a no-op.
    await deps.discard(produced.path).catch(error => {
      deps.log('warn', `could not remove ${produced.path}: ${String(error)}`)
    })

    return { ids: [asset.id], workspaces: [workspaceOfType(produced.type)] }
  }
}
