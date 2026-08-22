import type { Asset } from '@shared/domain/asset'
import { assetFilePath } from '@main/assets/protocol'
import { rewriteAssetIds } from '@main/provider/assetInputs'

/**
 * The asset ids a generation body carries, turned into PATHS on this disk.
 *
 * The cloud resolver uploads and answers a remote id; a runtime on this machine needs neither —
 * the file is already here. Routed by `services.ts` on whether the target is a local model,
 * because sending a picture to an account to run a generation that never leaves the machine is
 * a transfer nobody asked for, and it costs the person their bandwidth and their privacy.
 */
export type LocalAssetInputDeps = {
  /** The catalogue row an id names, or `null` when no local asset answers to it. */
  find: (assetId: string) => Promise<Asset | null>
  /** The folder the open project lives in, or `null` while none is open. */
  projectPath: () => string | null
}

export function createLocalAssetInputResolver(deps: LocalAssetInputDeps) {
  /**
   * Left AS IT STANDS when nothing here can answer for it, rather than dropped or guessed at.
   *
   * An id whose row is gone, an id pasted from the webapp — both share the `asset_` prefix and
   * neither names a file. The engine refuses what it cannot open and says so, where a body
   * silently missing its picture generates something plausible and wrong.
   */
  const pathOf = async (assetId: string): Promise<unknown> => {
    const root = deps.projectPath()
    const asset = await deps.find(assetId)
    if (!root || !asset?.path) return assetId

    // `assetFilePath` answers `null` for a path that climbs out of the project — a catalogue row
    // is data, and data is where a `../` comes from.
    return assetFilePath(root, asset.path) ?? assetId
  }

  return {
    resolveBody: (body: Record<string, unknown>) => rewriteAssetIds(body, pathOf),
  }
}
