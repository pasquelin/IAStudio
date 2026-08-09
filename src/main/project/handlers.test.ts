import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { memoryCatalog } from './catalog-fixtures'
import { registerProjectHandlers, type ProjectHandlerDeps } from './handlers'
import type { AsyncCatalog } from './catalog-client'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

const PROJECT = '/Users/someone/Films/Reel.scenario'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'A001',
  type: 'video',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

function deps(catalog: AsyncCatalog, overrides: Partial<ProjectHandlerDeps> = {}) {
  return {
    project: {
      create: vi.fn(),
      open: vi.fn(),
      current: () => null,
      path: () => PROJECT,
      catalog: () => catalog,
      close: vi.fn(),
    } as unknown as ProjectHandlerDeps['project'],
    assets: {} as ProjectHandlerDeps['assets'],
    newAssetId: () => 'asset-new',
    // Untouched by the channels under test, which read the catalogue and show a file.
    documents: {
      list: vi.fn(async () => []),
      read: vi.fn(async () => null),
      write: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
    reveal: vi.fn(),
    // Cancel: the safe answer, so a test that does not care about the dialog cannot destroy
    // anything by not caring.
    askUser: vi.fn(async () => 2),
    ...overrides,
  }
}

describe('project handlers', () => {
  let catalog: AsyncCatalog

  beforeEach(() => {
    resetHandlers()
    vi.clearAllMocks()
    catalog = memoryCatalog()
  })

  // The renderer has no filesystem: a path there is only ever text on screen, and handing the
  // window every user's folder layout widens what a compromised dependency could read.
  it('searches without ever handing back where a linked file sits', async () => {
    await catalog.add(asset({ sourcePath: '/Volumes/Rushes/A001.mov' }))
    registerProjectHandlers(deps(catalog))

    const found = await invoke(CHANNELS.assetsSearch, {})

    expect(found).toEqual([expect.not.objectContaining({ sourcePath: expect.anything() })])
    expect(found).toEqual([expect.objectContaining({ name: 'A001' })])
  })

  // Six numbers rather than the catalogue: the home draws a counter per kind, and reading the
  // rows to count them would carry a whole project across the boundary to print six integers.
  it('answers how many of each kind the project holds', async () => {
    await catalog.add(asset())
    await catalog.add(asset({ id: 'asset-2', type: 'image' }))
    registerProjectHandlers(deps(catalog))

    await expect(invoke(CHANNELS.assetsCounts)).resolves.toEqual({
      image: 1,
      video: 1,
      audio: 0,
      mesh: 0,
      texture: 0,
      skybox: 0,
    })
  })

  it('shows a linked file where the user actually put it', async () => {
    await catalog.add(asset({ sourcePath: '/Volumes/Rushes/A001.mov' }))
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await expect(invoke(CHANNELS.assetsReveal, 'asset-1')).resolves.toBe(true)
    expect(injected.reveal).toHaveBeenCalledWith('/Volumes/Rushes/A001.mov')
  })

  // Showing someone `.index/proxies/ab12….mp4` in place of the rush they linked is showing
  // them a file they never made.
  it('shows the rush and not the proxy the studio made of it', async () => {
    await catalog.add(
      asset({ sourcePath: '/Volumes/Rushes/A001.mov', proxyPath: '.index/proxies/ab12.mp4' }),
    )
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await invoke(CHANNELS.assetsReveal, 'asset-1')
    expect(injected.reveal).toHaveBeenCalledWith('/Volumes/Rushes/A001.mov')
  })

  it('shows a generated asset inside the project folder', async () => {
    await catalog.add(asset({ id: 'asset-1', type: 'image', path: 'assets/img/one.png' }))
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await invoke(CHANNELS.assetsReveal, 'asset-1')
    expect(injected.reveal).toHaveBeenCalledWith(`${PROJECT}/assets/img/one.png`)
  })

  it('answers no rather than opening anything for an asset with no file', async () => {
    await catalog.add(asset({ location: 'cloud' }))
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await expect(invoke(CHANNELS.assetsReveal, 'asset-1')).resolves.toBe(false)
    expect(injected.reveal).not.toHaveBeenCalled()
  })

  it('answers no for an asset the catalogue does not hold', async () => {
    const injected = deps(catalog)
    registerProjectHandlers(injected)

    await expect(invoke(CHANNELS.assetsReveal, 'asset-gone')).resolves.toBe(false)
    expect(injected.reveal).not.toHaveBeenCalled()
  })

  it('refuses an identifier that is not one, rather than passing junk to the catalogue', async () => {
    registerProjectHandlers(deps(catalog))
    await expect(invoke(CHANNELS.assetsReveal, '')).rejects.toThrow()
  })

  describe('a channel the renderer computed', () => {
    const backend = () => ({
      importFromUrl: vi.fn(),
      importFromBytes: vi.fn(async () => asset({ id: 'asset-new', type: 'texture' })),
      replaceBytes: vi.fn(),
    })

    /**
     * A channel goes in as a `texture`, which is what puts it under the right facet of the shelf,
     * and carries its `map` so the catalogue can later be asked which normal maps a project holds.
     */
    it('files it as a channel of the project, under a new identifier', async () => {
      const assets = backend()
      registerProjectHandlers(deps(catalog, { assets }))

      await invoke(CHANNELS.assetsSaveTexture, {
        name: 'Brique — Normale',
        map: 'normal',
        derivedFrom: 'asset-1',
        png: new Uint8Array([137, 80, 78, 71]),
      })

      expect(assets.importFromBytes).toHaveBeenCalledWith(
        {
          id: 'asset-new',
          name: 'Brique — Normale',
          type: 'texture',
          extension: '.png',
          map: 'normal',
          derivedFrom: 'asset-1',
        },
        new Uint8Array([137, 80, 78, 71]),
      )
    })

    it('never hands back where the file sits', async () => {
      const assets = backend()
      assets.importFromBytes = vi.fn(async () =>
        asset({ id: 'asset-new', type: 'texture', sourcePath: '/Users/someone/secret.png' }),
      )
      registerProjectHandlers(deps(catalog, { assets }))

      const saved = await invoke(CHANNELS.assetsSaveTexture, {
        name: 'Brique',
        map: 'normal',
        png: new Uint8Array([1]),
      })

      expect(saved).toEqual(expect.not.objectContaining({ sourcePath: expect.anything() }))
    })

    /** Bytes with no channel are an ordinary picture: this door files textures, and says so. */
    it('refuses a request that names no channel', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSaveTexture, { name: 'Brique', png: new Uint8Array([1]) }),
      ).rejects.toThrow()
    })

    /** The renderer is the sandboxed side, and this one writes a file to the user's disk. */
    it('refuses a channel it has never heard of', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSaveTexture, {
          name: 'Brique',
          map: 'displacement',
          png: new Uint8Array([1]),
        }),
      ).rejects.toThrow()
    })

    it('refuses a request with no name to file it under', async () => {
      registerProjectHandlers(deps(catalog, { assets: backend() }))

      await expect(
        invoke(CHANNELS.assetsSaveTexture, {
          name: '   ',
          map: 'normal',
          png: new Uint8Array([1]),
        }),
      ).rejects.toThrow()
    })
  })
})
