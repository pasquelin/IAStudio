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
import { handle } from '@main/ipc/handle'
import type { AsyncCatalog } from '@main/project/catalogClient'
import type { LocalBackend } from './localBackend'

/** Not exported: nothing outside this file builds one, and `unused:main` reads exports. */
type BundledTextureDeps = {
  /** Rejects while a project is being left, which is answered as « nothing installed ». */
  catalog: () => AsyncCatalog
  assets: LocalBackend
  newAssetId: () => string
  /** Where the shipped textures sit — injected like everything else that touches the disk. */
  folder: () => string
}

/** Where one lands in the project, and where it is looked for before being copied again. */
function pathOf(id: CheckerTextureId): string {
  return pathIn(DEFAULT_ASSET_FOLDERS.texture, checkerTextureFile(id))
}

/**
 * The working textures the app ships with, put into the open project — once.
 *
 * Copied rather than served from beside the app, and that is the whole design: a document holds
 * an asset id, and the `.gltf` it is written as has to point at a picture another application
 * can open. A texture living only inside the app would leave every exported scene bare.
 *
 * Idempotent through the catalogue: a project that already files one at its path keeps that row,
 * ids included, so reopening a project does not pile up copies.
 */
export function registerBundledTextureHandlers({
  catalog,
  assets,
  newAssetId,
  folder,
}: BundledTextureDeps): void {
  const install = async (id: CheckerTextureId): Promise<Asset> => {
    const held = await catalog().search({ path: pathOf(id) })
    const first = held[0]
    if (first) return first

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
        await readFile(join(folder(), checkerTextureFile(id))),
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
