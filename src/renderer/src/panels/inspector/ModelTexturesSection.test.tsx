import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssets } from '@/stores/assets'
import { ModelTexturesSection } from './ModelTexturesSection'

const openAsset = vi.fn()
vi.mock('@/helpers/open-asset', () => ({ openAsset: (...args: unknown[]) => openAsset(...args) }))

const MODEL = 'asset-model'

const texture = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-base',
  name: 'Robot — Couleur de base',
  type: 'texture',
  location: 'local',
  derivedFrom: MODEL,
  map: 'baseColor',
  tags: [],
  createdAt: '2026-08-13T10:00:00.000Z',
  ...overrides,
})

/** What the catalogue answers, and to whom. */
let derived: Asset[] = []
const search = vi.fn((query: AssetQuery) =>
  Promise.resolve(query.derivedFrom === MODEL ? derived : []),
)

function show(): void {
  render(<ModelTexturesSection assetId={MODEL} />)
}

describe('ModelTexturesSection', () => {
  beforeEach(() => {
    derived = [texture()]
    search.mockClear()
    openAsset.mockClear()
    installFakeBridge({ assets: { search } })
    useAssets.setState({ items: [] })
  })

  /**
   * The name over the channel, which is the shape every row of the studio draws: what the thing
   * IS on the first line, what KIND of thing on the second. This list read the other way round
   * for a while, and was the one list of the panel to be learnt twice.
   */
  it('shows a model’s own pictures, each named over the channel it plays', async () => {
    show()

    expect(await screen.findByText('Robot — Couleur de base')).toBeInTheDocument()
    expect(screen.getByText('Couleur de base')).toBeInTheDocument()
  })

  // Nothing invented under a picture the file gave no channel to: repeating its name as its own
  // kind would say something the extraction never said.
  it('says no kind for a picture the studio has no channel for', async () => {
    derived = [texture({ id: 'asset-ao', map: undefined, name: 'Robot — occlusion' })]

    show()

    expect(await screen.findByText('Robot — occlusion')).toBeInTheDocument()
    expect(screen.getAllByText(/Robot/)).toHaveLength(1)
  })

  it('opens a picture where it is edited, on the double-click every asset answers to', async () => {
    show()

    await userEvent.dblClick(await screen.findByRole('button', { name: /Couleur de base/ }))

    expect(openAsset).toHaveBeenCalledWith(derived[0])
  })

  /**
   * The id of a picture does not move when ⌘S rewrites the file behind it, so the tile draws its
   * URL off the stamp. A grid that only compared ids kept showing the picture from before the
   * edit — the very half of « edit it, and the model follows » this panel exists for.
   */
  it('repaints a tile whose picture was rewritten under the same id', async () => {
    derived = [texture({ localChangedAt: '2026-08-13T10:00:00.000Z' })]

    show()

    const before = await screen.findByRole('presentation')
    expect(before).toHaveAttribute('src', expect.stringContaining('v=2026-08-13T10'))

    derived = [texture({ localChangedAt: '2026-08-13T11:00:00.000Z' })]
    useAssets.setState({ items: [texture()] })

    await waitFor(() =>
      expect(screen.getByRole('presentation')).toHaveAttribute(
        'src',
        expect.stringContaining('v=2026-08-13T11'),
      ),
    )
  })

  /**
   * The whole reason the grid is subscribed: extraction runs at import with nobody waiting on it,
   * so a model dropped in the scene has no picture at all for a second or two.
   */
  it('fills itself when the pictures land, without the model being picked again', async () => {
    derived = []

    show()

    expect(await screen.findByText(/Aucune image extraite/)).toBeInTheDocument()

    derived = [texture()]
    useAssets.setState({ items: [texture()] })

    expect(await screen.findByText('Couleur de base')).toBeInTheDocument()
  })
})
