import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { orElse } from '@shared/promises'
import { withoutSourcePath, type Asset, type AssetType } from '@shared/domain/asset'
import { DEFAULT_ROLE_PATHS, type FolderRole } from '@shared/domain/folderRole'
import type { PbrChannel } from '@shared/domain/material'
import { pathIn } from '@shared/domain/folder'
import { RESOURCES_FOLDER } from '@shared/domain/project'
import { ownFileOf } from './protocol'
import type { AsyncCatalog } from '@main/project/catalogClient'
import type { LocalBackend } from './localBackend'

/**
 * One file the app ships, as putting it into a project needs to know it.
 *
 * `formerPaths` is what a project made before `.resources/` may hold it at: this folder is a
 * catalogue LOOKUP as much as a landing, and missing one installs a second copy under a fresh id
 * while the scenes go on pointing at the first.
 */
export type BundledResource = {
  /** The file beside the app, and what it is filed under — the two are the same stem. */
  file: string
  name: string
  extension: string
  type: AssetType
  role: FolderRole
  /** The PBR channel a texture answers, kept on the row as any other import would carry it. */
  map?: PbrChannel
  formerPaths: readonly string[]
}

export type BundledResourceDeps = {
  catalog: () => AsyncCatalog
  assets: LocalBackend
  newAssetId: () => string
  /** The open project's folder, which is what a stored path is relative to. */
  projectPath: () => string
  /** Whether a file is still there. Injected, exactly as `assets:absent` takes it. */
  exists: (file: string) => boolean
}

/**
 * Where one lands: under the studio's own folder, which no surface that browses assets lists.
 *
 * The tree inside mirrors the project's own, by `DEFAULT_ROLE_PATHS` names fixed rather than
 * resolved — the studio owns this folder, so no marker travels into it and no rename moves it.
 */
export function resourcePathOf(resource: BundledResource): string {
  return pathIn(pathIn(RESOURCES_FOLDER, DEFAULT_ROLE_PATHS[resource.role]), resource.file)
}

/**
 * One shipped file, put into the open project — once.
 *
 * Copied rather than served from beside the app, and that is the whole design: a document holds
 * an asset id, and the `.gltf` it is written as has to point at a file another application can
 * open. A mesh living only inside the app would leave every exported scene bare.
 *
 * Idempotent through the catalogue AND the disk: a project that files one at its path keeps that
 * row, ids included — unless its file is gone, in which case it is written again rather than left
 * as a reference every scene resolves to nothing.
 *
 * **Two angles blind, in clear.** An asset RENAMED in the shelf moves its file, so the next open
 * installs a second copy under a new id — the old scenes go on resolving, which is why this is the
 * cheap end of the trade. And a foreign file already sitting at that exact path makes the copy
 * land suffixed, again at every open. Both want an identity that is not the path — a hash — and
 * neither has been seen in practice.
 */
export async function installBundledResource(
  { catalog, assets, newAssetId, projectPath, exists }: BundledResourceDeps,
  folder: string,
  resource: BundledResource,
): Promise<Asset> {
  let held = (await catalog().search({ path: resourcePathOf(resource) }))[0]
  for (const former of resource.formerPaths) {
    held ??= (await catalog().search({ path: former }))[0]
  }
  // The row alone is not enough: a file deleted in the Finder leaves it behind, and everything
  // that points at it would resolve to nothing.
  const file = held ? ownFileOf(projectPath(), held) : null
  if (held && file !== null && exists(file)) return held

  const bytes = await readFile(join(folder, resource.file))

  // The SAME asset when the row is still there: its id is what the scenes of this project already
  // point at, and a fresh one would leave every one of them resolving to nothing.
  //
  // Falling back to a fresh import rather than letting it throw: `replaceBytes` writes to the path
  // the row carries and makes no folder, so a folder sent to the trash whole would fail here.
  if (held) {
    const rewritten = await orElse(assets.replaceBytes(held.id, bytes, resource.extension), null)
    if (rewritten) return withoutSourcePath(rewritten)
  }

  return withoutSourcePath(
    await assets.importFromBytes(
      {
        id: newAssetId(),
        name: resource.name,
        type: resource.type,
        extension: resource.extension,
        folderRole: resource.role,
        ...(resource.map ? { map: resource.map } : {}),
        resource: true,
      },
      bytes,
    ),
  )
}
