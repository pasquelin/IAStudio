import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { settleHome } from '../home-fixtures'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { openFromHome } from '../open'
import type * as HomeOpenModule from '../open'
import { Library } from './Library'

// Where the asset lands is `ASSET_INTENTS`' business, and it needs open documents to have one.
// What this band answers for is which of the two gestures it calls. Mocked at `home/open` rather
// than at the helper: the band loads the cascade on the click, to keep it out of the opening chunk.
vi.mock('../open', async importOriginal => ({
  ...(await importOriginal<typeof HomeOpenModule>()),
  openFromHome: vi.fn(),
}))

/** The local twin of `cloudAsset`, as the collector writes it after a pull. */
function localAsset(overrides: Partial<Asset> = {}): Asset {
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

function cloudAsset(overrides: Partial<CloudAsset> = {}): CloudAsset {
  return {
    id: 'cloud_1',
    name: 'boulder.png',
    type: 'image',
    remoteType: 'texture',
    ownerId: 'team_1',
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    privacy: 'private',
    tags: [],
    collectionIds: [],
    thumbnailUrl: 'https://cdn.example/thumb.png',
    generation: { modelId: 'flux_2', modelLabel: 'FLUX.2', prompt: 'a boulder', params: {} },
    ...overrides,
  }
}

/**
 * `held` is what the project's catalogue answers, and it has to agree with `useAssets`.
 *
 * A case that seeds the store and leaves the bridge saying the project holds nothing is a case
 * that any refresh contradicts — and one is always in flight: `pull` ends with `invalidate()`,
 * which is a 200 ms debounce at module scope, so the timer a case leaves behind fires inside a
 * LATER one and empties its shelf under it. That is the whole of § 0.2's third group: the band
 * flipped from "open" to "fetch" between the query and the click, and how often depended on how
 * busy the machine was.
 */
function install(assets: readonly CloudAsset[], held: readonly Asset[] = []) {
  const browse = vi.fn(() => Promise.resolve({ assets: [...assets], cursor: null }))
  const pull = vi.fn(() => Promise.resolve([]))
  installFakeBridge({
    cloud: { browse, pull },
    assets: { search: () => Promise.resolve([...held]) },
  })
  return { browse, pull }
}

beforeEach(() => {
  // `vi.fn` keeps its calls across tests, and a count read from the previous one proves nothing.
  vi.clearAllMocks()
  settleHome()
  useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } })
  useCloud.setState({ busy: false, outcomes: [] })
  // Which of these the project holds decides what a click does, so it has to start from nothing.
  useAssets.setState({ items: [] })
})

describe('the library shelf', () => {
  /**
   * The thumbnail, not the asset: its URL is public and stable, while the asset's own carries a
   * signature that appending anything to would invalidate — the CDN answers 403.
   */
  it('captions each tile with the model, and draws the thumbnail it may resize', async () => {
    install([cloudAsset()])
    const { container } = render(<Library />)

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'https://cdn.example/thumb.png?width=264',
    )
  })

  it('fetches into the project when one is open', async () => {
    const { pull } = install([cloudAsset()])
    render(<Library />)

    await userEvent.click(await screen.findByRole('button', { name: /boulder\.png/ }))

    expect(pull).toHaveBeenCalledWith(['cloud_1'])
  })

  /**
   * The section only needs a key, not a folder — what the account holds is worth showing before
   * a project is open. But nothing here may act without one to write into.
   */
  it('shows what the account holds without a project, and offers no way to fetch it', async () => {
    useProject.setState({ project: null, known: true })
    install([cloudAsset()])
    render(<Library />)

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /boulder\.png/ })).not.toBeInTheDocument()
  })

  it('takes itself off when the library answers nothing', async () => {
    const { browse } = install([])
    const { container } = render(<Library />)

    await vi.waitFor(() => expect(browse).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * The rule the whole home follows now: a click on a picture opens it. A library asset already
   * on the disk has something to open, so it opens — and one that is not has nothing, so
   * fetching stays the main action there and only there. Implicit fetching was ruled out.
   */
  describe('what a click on the picture does', () => {
    it('opens an asset the project has already fetched', async () => {
      const fetched: Asset = { ...localAsset(), remoteAssetId: 'cloud_1' }
      install([cloudAsset()], [fetched])
      useAssets.setState({ items: [fetched] })
      render(<Library />)

      await userEvent.click(await screen.findByRole('button', { name: /Ouvrir.+boulder\.png/ }))

      expect(openFromHome).toHaveBeenCalledTimes(1)
    })

    it('fetches one the project does not hold, and says so by name', async () => {
      const { pull } = install([cloudAsset()])
      render(<Library />)

      // Loose on the spaces: the French bundle sets a non-breaking one inside its quotes.
      await userEvent.click(await screen.findByRole('button', { name: /Récupérer.+boulder\.png/ }))

      expect(pull).toHaveBeenCalledWith(['cloud_1'])
      expect(openFromHome).not.toHaveBeenCalled()
    })
  })

  /**
   * The one an empty band could not say. A 429 took the shelf off the page without a word —
   * and since `cloudBrowse` goes through `quietlyReducedBy`, the journal did not say it either,
   * so there was no trace of it anywhere the user could look.
   */
  it('stays and says so when the library refuses, rather than disappearing', async () => {
    installFakeBridge({ cloud: { browse: () => Promise.reject(new Error('429')) } })
    render(<Library />)

    expect(await screen.findByText(/n’a pas obtenu de réponse/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('reads the library again when that button is pressed', async () => {
    const browse = vi
      .fn<() => Promise<{ assets: CloudAsset[]; cursor: string | null }>>()
      .mockRejectedValueOnce(new Error('429'))
      .mockResolvedValueOnce({ assets: [cloudAsset()], cursor: null })
    installFakeBridge({ cloud: { browse } })
    render(<Library />)
    await screen.findByRole('button', { name: 'Réessayer' })

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
  })

  it('reads the library again when the active key changes', async () => {
    const { browse } = install([cloudAsset()])
    render(<Library />)

    await screen.findByText('FLUX.2')
    useSettings.setState({ auth: { authenticated: true, ownerId: 'team_2' } })

    await vi.waitFor(() => expect(browse).toHaveBeenCalledTimes(2))
  })
})
