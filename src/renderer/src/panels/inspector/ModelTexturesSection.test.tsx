import { render, screen } from '@testing-library/react'
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
   * The channel, not the file name: a model's pictures are all called « Robot — … » and differ by
   * that word alone. A slot the studio has no channel for keeps the name the extraction gave it.
   */
  it('shows a model’s own pictures, each under the channel it plays', async () => {
    derived = [texture(), texture({ id: 'asset-ao', map: undefined, name: 'Robot — occlusion' })]

    show()

    expect(await screen.findByText('Couleur de base')).toBeInTheDocument()
    expect(screen.getByText('Robot — occlusion')).toBeInTheDocument()
    expect(screen.queryByText('Robot — Couleur de base')).not.toBeInTheDocument()
  })

  it('opens a picture where it is edited, on the double-click every asset answers to', async () => {
    show()

    await userEvent.dblClick(await screen.findByRole('button', { name: /Couleur de base/ }))

    expect(openAsset).toHaveBeenCalledWith(derived[0])
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
