import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

/** What the catalogue answers, and what it was asked. */
let derived: Asset[] = []
const search = vi.fn((query: AssetQuery) =>
  Promise.resolve(query.derivedFrom === MODEL ? derived : []),
)

function show(): void {
  render(<ModelTexturesSection assetId={MODEL} textures={{}} onChange={vi.fn()} />)
}

describe('ModelTexturesSection', () => {
  beforeEach(() => {
    derived = [texture()]
    search.mockClear()
    openAsset.mockClear()
    installFakeBridge({ assets: { search } })
    useAssets.setState({ items: [] })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('shows a model’s own pictures, each one under the channel it plays', async () => {
    derived = [texture(), texture({ id: 'asset-orm', map: 'roughness', name: 'Robot — ORM' })]

    show()

    expect(await screen.findByText('Couleur de base')).toBeInTheDocument()
    expect(screen.getByText('Rugosité')).toBeInTheDocument()
    // The channel over the file name: seven pictures of one model differ by that word alone.
    expect(screen.queryByText('Robot — ORM')).not.toBeInTheDocument()
  })

  /** A slot the studio has no channel for keeps the name the extraction gave it. */
  it('falls back to the picture’s name when it holds no channel', async () => {
    derived = [texture({ map: undefined, name: 'Robot — occlusion' })]

    show()

    expect(await screen.findByText('Robot — occlusion')).toBeInTheDocument()
  })

  it('opens a picture where it is edited, on the double-click every asset answers to', async () => {
    show()

    await userEvent.dblClick(await screen.findByLabelText('Ouvrir Couleur de base'))

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

  it('keeps the five overrides folded away, under the pictures', async () => {
    show()

    await waitFor(() => expect(search).toHaveBeenCalled())

    expect(screen.queryByText('Normales')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Remplacer un canal/ }))

    expect(screen.getByText('Normales')).toBeInTheDocument()
  })
})
