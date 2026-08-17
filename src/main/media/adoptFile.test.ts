import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { AsyncCatalog } from '@main/project/catalogClient'
import { memoryCatalog } from '@main/project/catalog-fixtures'
import { adoptFile, type AdoptFileDeps } from './adoptFile'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

let root = ''
let catalog: AsyncCatalog
let landed: Asset[]
let lines: string[]

const deps = (overrides: Partial<AdoptFileDeps> = {}): AdoptFileDeps => ({
  projectPath: () => root,
  catalog: () => catalog,
  newAssetId: () => 'asset-1',
  now: () => '2026-08-17T10:00:00.000Z',
  hash: async () => 'fingerprint',
  probeFile: async () => ({ duration: 4_000_000, codec: 'h264' }),
  onAdopted: asset => landed.push(asset),
  record: report => lines.push(report.messageKey),
  ...overrides,
})

const put = async (relative: string, bytes: Uint8Array = PNG): Promise<void> => {
  await mkdir(join(root, relative, '..'), { recursive: true })
  await writeFile(join(root, relative), bytes)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'adopt-'))
  catalog = memoryCatalog()
  landed = []
  lines = []
})

afterEach(async () => {
  await catalog.close()
  await rm(root, { recursive: true, force: true })
})

describe('adoptFile', () => {
  it('gives a picture the project holds a row pointing INSIDE the project', async () => {
    await put('Images/facade.jpg')

    const asset = await adoptFile('Images/facade.jpg', deps())

    expect(asset).toMatchObject({
      name: 'facade',
      type: 'image',
      location: 'local',
      path: 'Images/facade.jpg',
      hash: 'fingerprint',
    })
    // The row must NOT read as a linked external media: that is what `ingest` writes, and it is
    // what stops the rescan following the file when the user moves it.
    expect(asset?.sourcePath).toBeUndefined()
    expect(await catalog.search({ path: 'Images/facade.jpg' })).toHaveLength(1)
  })

  it('says so in the journal, and hands the asset to whatever derives from it', async () => {
    await put('Images/facade.jpg')

    const asset = await adoptFile('Images/facade.jpg', deps())

    expect(lines).toEqual(['activity.fileAdopted'])
    expect(landed).toEqual([asset])
  })

  it('hands back the row it already has rather than doubling it', async () => {
    await put('Images/facade.jpg')
    const first = await adoptFile('Images/facade.jpg', deps())

    const second = await adoptFile('Images/facade.jpg', deps({ newAssetId: () => 'asset-2' }))

    expect(second?.id).toBe(first?.id)
    expect(await catalog.search({ path: 'Images/facade.jpg' })).toHaveLength(1)
  })

  it('leaves a file the studio cannot show alone, writing nothing', async () => {
    await put('Notes/brief.txt', new Uint8Array([0x68, 0x69]))
    await put('Images/photo.heic')

    expect(await adoptFile('Notes/brief.txt', deps())).toBeNull()
    expect(await adoptFile('Images/photo.heic', deps())).toBeNull()
    expect(await catalog.search({})).toHaveLength(0)
    expect(lines).toEqual([])
  })

  /**
   * The suffix wins even when it lies, as every system does — the one exception is having no
   * suffix at all, where the bytes are the only thing left to read.
   */
  it('trusts a present extension over the bytes, and the bytes when there is none', async () => {
    await put('Notes/photo.txt', PNG)
    await put('Images/scan', PNG)

    expect(await adoptFile('Notes/photo.txt', deps())).toBeNull()
    expect(await adoptFile('Images/scan', deps())).toMatchObject({ type: 'image', name: 'scan' })
  })

  it('reads the length of a take, and asks for none of a picture', async () => {
    const probeFile = vi.fn(async () => ({ duration: 4_000_000, codec: 'h264' }))
    await put('Video/rush.mp4')
    await put('Images/facade.jpg')

    const take = await adoptFile('Video/rush.mp4', deps({ probeFile }))
    await adoptFile('Images/facade.jpg', deps({ probeFile, newAssetId: () => 'asset-2' }))

    expect(take?.probe).toEqual({ duration: 4_000_000, codec: 'h264' })
    expect(probeFile).toHaveBeenCalledTimes(1)
  })

  /**
   * `.index/` holds the previews and the proxies the studio rewrites at will, and the explorer
   * SHOWS them when the reader asks. A row pointing in there dies at the next eviction, and a
   * proxy adopted as a take would be given a proxy of its own.
   */
  it('refuses what the studio keeps for itself, however the reader reached it', async () => {
    await put('.index/thumbnails/3f9a.png')
    await put('.index/posters/asset_1.png')

    expect(await adoptFile('.index/thumbnails/3f9a.png', deps())).toBeNull()
    expect(await adoptFile('.index/posters/asset_1.png', deps())).toBeNull()
    expect(await catalog.search({})).toHaveLength(0)
    expect(lines).toEqual([])
  })

  /**
   * The row only exists once the fingerprint and the probe have answered — seconds, for a rush —
   * and nothing in the catalogue holds `path` unique. Two double-clicks in that window used to
   * mint two rows over one file, and derive it twice.
   */
  it('mints one row for two adoptions of the same file at once', async () => {
    await put('Video/rush.mp4')
    let ids = 0
    const shared = deps({
      newAssetId: () => `asset-${(ids += 1)}`,
      probeFile: async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { duration: 4_000_000, codec: 'h264' }
      },
    })

    const [first, second] = await Promise.all([
      adoptFile('Video/rush.mp4', shared),
      adoptFile('Video/rush.mp4', shared),
    ])

    expect(second?.id).toBe(first?.id)
    expect(await catalog.search({ path: 'Video/rush.mp4' })).toHaveLength(1)
    expect(landed).toHaveLength(1)
  })

  it('refuses a path that leaves the project, and a folder', async () => {
    await mkdir(join(root, 'Textures'), { recursive: true })

    expect(await adoptFile('../elsewhere/secret.png', deps())).toBeNull()
    expect(await adoptFile('Textures', deps())).toBeNull()
  })

  it('keeps a row that carries no fingerprint rather than losing the file', async () => {
    await put('Images/facade.jpg')

    const asset = await adoptFile('Images/facade.jpg', deps({ hash: async () => null }))

    expect(asset?.hash).toBeUndefined()
    expect(asset?.path).toBe('Images/facade.jpg')
  })
})
