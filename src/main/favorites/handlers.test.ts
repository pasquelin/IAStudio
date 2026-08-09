import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { FavoriteRecipe } from '@shared/domain/favorite'
import { CHANNELS } from '@shared/ipc'
import { invoke as invokeChannel, resetHandlers } from '@main/ipc/test-harness'
import { memoryCatalog } from '@main/project/catalog-fixtures'
import type { AsyncCatalog } from '@main/project/catalog-client'
import type { ProjectStore } from '@main/project/store'
import { registerFavoriteHandlers, type FavoriteHandlerDeps } from './handlers'
import { createFavorites } from './store'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  // The harness answers `unknown`, and every caller knows the shape its own channel returns.
  // A guard here would be a second copy of the contract `shared/ipc.ts` already states.
  const answer: unknown = await invokeChannel(channel, ...args)
  return answer as T
}

const PROJECT = '/Users/someone/Films/Reel.scenario'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'boulder.png',
  type: 'image',
  location: 'local',
  tags: [],
  createdAt: '2026-08-08T10:00:00.000Z',
  path: 'assets/img/boulder.png',
  generation: {
    modelId: 'flux_2',
    modelLabel: 'FLUX.2',
    prompt: 'a mossy boulder',
    params: { width: 1024 },
  },
  ...overrides,
})

let catalog: AsyncCatalog

async function register(overrides: Partial<FavoriteHandlerDeps> = {}) {
  const folder = await mkdtemp(join(tmpdir(), 'favorites-handlers-'))
  const readThumbnail = vi.fn(() => Promise.resolve(new Uint8Array([9])))

  const deps: FavoriteHandlerDeps = {
    favorites: createFavorites(folder),
    project: {
      path: () => PROJECT,
      catalog: () => catalog,
    } as unknown as ProjectStore,
    readThumbnail,
    newFavoriteId: () => 'favorite_1',
    now: () => '2026-08-09T10:00:00.000Z',
    ...overrides,
  }

  registerFavoriteHandlers(deps)
  return { ...deps, readThumbnail }
}

beforeEach(() => {
  resetHandlers()
  vi.clearAllMocks()
  catalog = memoryCatalog()
})

describe('the favourites channels', () => {
  /**
   * The window sends an id and nothing else: the recipe is read from the catalogue here. One
   * less shape to validate at the boundary, and one less way for the shelf to hold a recipe
   * that never produced anything.
   */
  it('reads the recipe off the catalogue rather than taking the window at its word', async () => {
    await catalog.add(asset())
    await register()

    const [recipe] = await invoke<FavoriteRecipe[]>(CHANNELS.favoritesPin, 'asset-1')

    expect(recipe?.generation).toMatchObject({ modelId: 'flux_2', prompt: 'a mossy boulder' })
    expect(recipe?.label).toBe('FLUX.2')
    expect(recipe?.type).toBe('image')
  })

  it('copies a still of the asset beside the recipe', async () => {
    await catalog.add(asset())
    const { readThumbnail } = await register()

    const [recipe] = await invoke<FavoriteRecipe[]>(CHANNELS.favoritesPin, 'asset-1')

    expect(readThumbnail).toHaveBeenCalledWith(join(PROJECT, 'assets/img/boulder.png'))
    expect(recipe?.hasThumbnail).toBe(true)
  })

  it('keeps the recipe when the asset has no picture to copy', async () => {
    await catalog.add(asset({ type: 'audio', path: 'assets/aud/drone.wav' }))
    await register({ readThumbnail: () => Promise.resolve(null) })

    const [recipe] = await invoke<FavoriteRecipe[]>(CHANNELS.favoritesPin, 'asset-1')

    expect(recipe?.hasThumbnail).toBe(false)
  })

  // An import has no recipe to keep. Answering the list unchanged is what lets the window redraw
  // from one truth whatever the pin did.
  it('answers the list unchanged for an asset nobody generated', async () => {
    await catalog.add(asset({ generation: undefined }))
    await register()

    await expect(invoke(CHANNELS.favoritesPin, 'asset-1')).resolves.toEqual([])
  })

  it('answers the list unchanged when no project is open', async () => {
    await register({
      project: {
        path: () => PROJECT,
        catalog: () => {
          throw new Error('no project open')
        },
      } as unknown as ProjectStore,
    })

    await expect(invoke(CHANNELS.favoritesPin, 'asset-1')).resolves.toEqual([])
  })

  it('lists and drops what was pinned', async () => {
    await catalog.add(asset())
    await register()

    await invoke(CHANNELS.favoritesPin, 'asset-1')
    await expect(invoke(CHANNELS.favoritesList)).resolves.toHaveLength(1)

    await expect(invoke(CHANNELS.favoritesUnpin, 'favorite_1')).resolves.toEqual([])
  })

  // Both identifiers end up in a `join` against the favourites folder, and a window is trusted
  // for nothing — see `registerDiagnosticsHandlers` for the same reflex.
  it('refuses an identifier that would climb out of the folder', async () => {
    await register()

    await expect(invoke(CHANNELS.favoritesUnpin, '../../secrets')).rejects.toThrow()
    await expect(invoke(CHANNELS.favoritesPin, '')).rejects.toThrow()
  })
})
