import { orElse } from '@shared/promises'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CHECKER_TEXTURE_IDS,
  CHECKER_TEXTURE_NAMES,
  checkerTextureFile,
  type CheckerTextureId,
  type InstalledCheckerTexture,
} from '@shared/domain/checkerTexture'
import { DEFAULT_ASSET_FOLDERS, withoutSourcePath, type Asset } from '@shared/domain/asset'
import { pathIn } from '@shared/domain/folder'
import { CHANNELS } from '@shared/ipc'
import { ownFileOf } from './protocol'
import { handle } from '@main/ipc/handle'
import type { AsyncCatalog } from '@main/project/catalogClient'
import type { LocalBackend } from './localBackend'

/** Not exported: nothing outside this file builds one, and `unused:main` reads exports. */
type BundledTextureDeps = {
  catalog: () => AsyncCatalog
  assets: LocalBackend
  newAssetId: () => string
  /** Where the shipped textures sit — injected like everything else that touches the disk. */
  folder: () => string
  /** The open project's folder, which is what a stored path is relative to. */
  projectPath: () => string
  /** Whether a file is still there. Injected, exactly as `assets:absent` takes it. */
  exists: (file: string) => boolean
}

/** Where one lands in the project, and where it is looked for before being copied again. */
function pathOf(id: CheckerTextureId): string {
  return pathIn(DEFAULT_ASSET_FOLDERS.texture, checkerTextureFile(id))
}

/**
 * Where a project created before `Textures` became `Materials` filed it — searched too, since this
 * folder is a catalogue LOOKUP here and not merely where a new file lands.
 *
 * Without it the first 3D open of such a project installs a second set of four under fresh ids,
 * and its meshes go on wearing the first: eight working textures where there should be four.
 */
function formerPathOf(id: CheckerTextureId): string {
  return pathIn('Textures', checkerTextureFile(id))
}

/**
 * The working textures the app ships with, put into the open project — once.
 *
 * Copied rather than served from beside the app, and that is the whole design: a document holds
 * an asset id, and the `.gltf` it is written as has to point at a picture another application
 * can open. A texture living only inside the app would leave every exported scene bare.
 *
 * Idempotent through the catalogue AND the disk: a project that files one at its path keeps that
 * row, ids included — unless its file is gone, in which case it is copied again rather than left
 * as a reference every mesh resolves to nothing.
 *
 * **Two angles blind, in clear.** An asset RENAMED in the shelf moves its file, so the next open
 * installs a second copy under a new id — the old meshes go on resolving, which is why this is
 * the cheap end of the trade. And a foreign file already sitting at that exact path makes the
 * copy land suffixed, again at every open. Both want an identity that is not the path — a hash —
 * and neither has been seen in practice.
 */
export function registerBundledTextureHandlers({
  catalog,
  assets,
  newAssetId,
  folder,
  projectPath,
  exists,
}: BundledTextureDeps): void {
  const install = async (id: CheckerTextureId): Promise<Asset> => {
    const held =
      (await catalog().search({ path: pathOf(id) }))[0] ??
      (await catalog().search({ path: formerPathOf(id) }))[0]
    // The row alone is not enough: a texture deleted in the Finder leaves it behind, and every
    // primitive of that project would then be born wearing a map that resolves to no file.
    const file = held ? ownFileOf(projectPath(), held) : null
    if (held && file !== null && exists(file)) return held

    const bytes = await readFile(join(folder(), checkerTextureFile(id)))

    // The SAME asset when the row is still there: its id is what the scenes of this project
    // already point at, and a fresh one would leave every one of them resolving to nothing.
    //
    // Falling back to a fresh import rather than letting it throw: `replaceBytes` writes to the
    // path the row carries and makes no folder, so a `Materials/` sent to the trash whole would
    // fail on the first of the four and cost the project all of them.
    if (held) {
      const rewritten = await orElse(assets.replaceBytes(held.id, bytes, '.png'), null)
      if (rewritten) return withoutSourcePath(rewritten)
    }

    return withoutSourcePath(
      await assets.importFromBytes(
        {
          id: newAssetId(),
          name: CHECKER_TEXTURE_NAMES[id],
          // A working texture is a texture in the catalogue: it lands under the shelf's own
          // facet, and a mesh reads it through the same door as any other map.
          type: 'texture',
          extension: '.png',
          map: 'baseColor',
        },
        bytes,
      ),
    )
  }

  handle(CHANNELS.texturesInstallBundled, async (): Promise<InstalledCheckerTexture[]> => {
    const installed: InstalledCheckerTexture[] = []

    // One at a time rather than all four at once: they land in one folder, and `freeAssetPath`
    // reads the disk to pick a free name — four concurrent writers would each read « free ».
    for (const id of CHECKER_TEXTURE_IDS) {
      installed.push({ id, assetId: (await install(id)).id })
    }

    return installed
  })
}
