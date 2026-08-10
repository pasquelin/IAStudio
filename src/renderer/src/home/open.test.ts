import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { HOME_PROJECT } from './home-fixtures'
import { openFromHome } from './open'

const openAsset = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('@/helpers/open-asset', () => ({ openAsset }))

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    name: 'boulder.png',
    type: 'image',
    location: 'local',
    tags: [],
    createdAt: '2026-08-08T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  installFakeBridge({})
  useProject.setState({ project: HOME_PROJECT, known: true })
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useLayouts.setState({ home: true, activeWorkspace: 'video' })
})

/**
 * The gesture the home promises: a click on a picture opens it. The cascade only ever sends an
 * asset into a document already open, and the home is on screen precisely when none is — so
 * opening from here has to make one, or the promise is empty on a fresh start.
 */
describe('opening an asset from the home', () => {
  it('makes the document its kind needs when nothing is open to take it', async () => {
    await openFromHome(asset())

    const documents = Object.values(useDocuments.getState().documents)
    expect(documents).toHaveLength(1)
    expect(documents[0]?.workspace).toBe('image')
    expect(useLayouts.getState().activeWorkspace).toBe('image')
    expect(openAsset).toHaveBeenCalledTimes(1)
  })

  /** A sound goes to the audio workspace, not to whichever one the home was left on. */
  it('reads the workspace off the asset, not off where the user was', async () => {
    await openFromHome(asset({ type: 'audio', name: 'drone.wav' }))

    expect(useLayouts.getState().activeWorkspace).toBe('audio')
  })

  /**
   * A document that can already take it is the whole point of the cascade — making a second one
   * beside it would leave the user with a blank editor over the one holding their work.
   */
  it('makes nothing when a document can already take the asset', async () => {
    const existing = await useDocuments.getState().create('image')
    if (!existing) throw new Error('expected a document')
    useDocuments.setState({ activeId: existing.id })

    await openFromHome(asset())

    expect(Object.keys(useDocuments.getState().documents)).toHaveLength(1)
    expect(openAsset).toHaveBeenCalledTimes(1)
  })

  /**
   * No project means no folder to make a document in. `openAsset` says so in the journal, as it
   * does for any asset with nowhere to go — one silence, not two.
   */
  it('still hands the asset on with no project, rather than stopping short', async () => {
    useProject.setState({ project: null, known: true })

    await openFromHome(asset())

    expect(Object.keys(useDocuments.getState().documents)).toHaveLength(0)
    expect(openAsset).toHaveBeenCalledTimes(1)
  })
})
