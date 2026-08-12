import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { HOME_PROJECT } from './home-fixtures'
import { openFromHome } from './open'

const openAsset = vi.hoisted(() => vi.fn<(asset: Asset) => Promise<void>>(() => Promise.resolve()))

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
 * What the home adds to the gesture is WHEN the gesture is loaded, and nothing else: making the
 * document an asset needs belongs to `openAsset`, which every shelf reaches the same way.
 *
 * The deferral is the point — `eager-graph.test.ts` holds the budget it protects — and it is
 * exactly what a mount-time import would silently undo.
 */
describe('opening an asset from the home', () => {
  it('hands the asset over, whole', async () => {
    const clicked = asset()

    await openFromHome(clicked)

    expect(openAsset).toHaveBeenCalledTimes(1)
    expect(vi.mocked(openAsset).mock.calls[0]?.[0]).toBe(clicked)
  })

  // The refusal is `openAsset`'s to journal, here as anywhere else: one silence, not two.
  it('still hands it over with no project, rather than stopping short', async () => {
    useProject.setState({ project: null, known: true })

    await openFromHome(asset())

    expect(Object.keys(useDocuments.getState().documents)).toHaveLength(0)
    expect(openAsset).toHaveBeenCalledTimes(1)
  })
})
