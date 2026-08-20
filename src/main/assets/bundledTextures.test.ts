import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { CHANNELS } from '@shared/ipc'
import type { InstalledCheckerTexture } from '@shared/domain/checkerTexture'
import { invoke as invokeChannel, resetHandlers } from '@main/ipc/testHarness'
import { memoryCatalog } from '@main/project/catalog-fixtures'
import type { AsyncCatalog } from '@main/project/catalogClient'
import { registerBundledTextureHandlers } from './bundledTextures'
import type { LocalBackend } from './localBackend'

vi.mock('electron', async () => (await import('@main/ipc/testHarness')).mockElectron())

/** The four files as they ship, written into a folder of this run's own. */
function shippedFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), 'checker-'))
  for (const name of ['GridLarge', 'GridSmall', 'CheckerLarge', 'CheckerSmall']) {
    writeFileSync(join(folder, `${name}.png`), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  }
  return folder
}

let catalog: AsyncCatalog
let written: Asset[]

/** Writes where the real one writes — the path is what the idempotence is read from. */
function backend(): LocalBackend {
  const importFromBytes = async (request: { id: string; name: string }): Promise<Asset> => {
    const asset: Asset = {
      id: request.id,
      name: request.name,
      type: 'texture',
      location: 'local',
      path: `Textures/${request.name}.png`,
      tags: [],
      createdAt: '2026-08-20T10:00:00.000Z',
    }
    written.push(asset)
    return catalog.add(asset)
  }

  // Everything else of the backend is out of reach of this handler, and a double that pretended
  // otherwise would be describing a contract this file does not read.
  return { importFromBytes } as unknown as LocalBackend
}

function install(folder: string, ids = 0): Promise<InstalledCheckerTexture[]> {
  let minted = ids
  registerBundledTextureHandlers({
    catalog: () => catalog,
    assets: backend(),
    newAssetId: () => `asset_${(minted += 1)}`,
    folder: () => folder,
  })

  return invokeChannel(CHANNELS.texturesInstallBundled) as Promise<InstalledCheckerTexture[]>
}

describe('the working textures shipped with the app', () => {
  beforeEach(() => {
    resetHandlers()
    catalog = memoryCatalog()
    written = []
  })

  it('puts all four into the project, under the names a document refers to them by', async () => {
    const installed = await install(shippedFolder())

    expect(installed.map(one => one.id)).toEqual([
      'gridLarge',
      'gridSmall',
      'checkerLarge',
      'checkerSmall',
    ])
    expect(written.map(asset => asset.path)).toEqual([
      'Textures/GridLarge.png',
      'Textures/GridSmall.png',
      'Textures/CheckerLarge.png',
      'Textures/CheckerSmall.png',
    ])
  })

  // Reopening a project must not pile up copies, and — more to the point — the ids must not
  // move: a scene saved yesterday points at the row installed then.
  it('keeps the assets a project already holds, ids included', async () => {
    const folder = shippedFolder()
    const first = await install(folder)
    written = []

    const second = await install(folder, 100)

    expect(second).toEqual(first)
    expect(written).toEqual([])
  })
})
