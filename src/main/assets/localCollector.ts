import type { AssetType } from '@shared/domain/asset'
import { workspaceOfType } from '@shared/domain/assetKind'
import { generatedAssetName } from '@shared/domain/assetName'
import type { AssetCollector, CollectedOutputs } from '@main/provider/jobManager'
import type { LocalBackend } from './localBackend'

/**
 * Brings a generation made on THIS machine into the project.
 *
 * Nothing is downloaded and nothing is retrieved: the engine wrote a file the main process owns,
 * and what is left is to read it, file it, and delete what was only ever a hand-off. The cloud
 * collector cannot serve here — every branch of it turns on a remote asset id there is none of.
 */

/**
 * What a finished local job left behind, as the collector needs to see it.
 *
 * Three fields and not the runner's whole answer: the device and the backend say what RAN it,
 * which belongs to the log and to the screen, and nothing here files them.
 */
export type CollectableProduction = {
  /** The file the engine wrote. It is the studio's to file, and to delete. */
  readonly path: string
  readonly type: AssetType
  /** What the person typed, which is what names the asset — never the model that answered. */
  readonly prompt: string
}

export type LocalCollectorDeps = {
  /** What this job produced, or `null` for one that produced a sentence rather than a file. */
  producedBy: (jobId: string) => CollectableProduction | null
  readFile: (path: string) => Promise<Uint8Array>
  /** Removes the hand-off. A failure here costs a temporary file, never the asset. */
  discard: (path: string) => Promise<void>
  backend: LocalBackend
  newId: () => string
  log: (level: 'info' | 'warn', message: string) => void
}

const NOTHING: CollectedOutputs = { ids: [], workspaces: [] }

/** The extension a file already carries, which is what the engine chose to write. */
function extensionOf(path: string): string {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1) : 'png'
}

export function createLocalCollector(deps: LocalCollectorDeps): AssetCollector {
  return async job => {
    const produced = deps.producedBy(job.id)
    // A conversation produced no file, and answering nothing is the honest outcome rather than a
    // failure: the job succeeded, it simply has nothing to file.
    if (!produced) return NOTHING

    const bytes = await deps.readFile(produced.path)
    const asset = await deps.backend.importFromBytes(
      {
        id: deps.newId(),
        name: generatedAssetName({ prompt: produced.prompt, label: job.label, index: 0, total: 1 }),
        type: produced.type,
        jobId: job.id,
        extension: extensionOf(produced.path),
      },
      bytes,
    )

    // After the import, never before: the bytes are in the project, so losing the hand-off costs
    // nothing — where deleting first would lose the generation if the import then failed.
    await deps.discard(produced.path).catch(error => {
      deps.log('warn', `could not remove ${produced.path}: ${String(error)}`)
    })

    return { ids: [asset.id], workspaces: [workspaceOfType(produced.type)] }
  }
}
