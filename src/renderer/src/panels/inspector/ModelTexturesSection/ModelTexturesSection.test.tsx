import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAssets } from '@/stores/assets'
import type * as OpenModelMaterial from '@/spaces/textures/openModelMaterial'
import { ModelTexturesSection } from './ModelTexturesSection'

const openAsset = vi.fn()
vi.mock('@/helpers/openAsset', () => ({ openAsset: (...args: unknown[]) => openAsset(...args) }))

const openModelMaterial = vi.fn()
// Partial: `hasChannel` is what decides which rows this section draws at all, so a copy of it
// written here would let the section and its test disagree about what a channel is.
vi.mock('@/spaces/textures/openModelMaterial', async importOriginal => ({
  ...(await importOriginal<typeof OpenModelMaterial>()),
  openModelMaterial: (...args: unknown[]) => openModelMaterial(...args),
}))

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
  render(<ModelTexturesSection assetId={MODEL} name="Robot" />)
}

describe('ModelTexturesSection', () => {
  beforeEach(() => {
    derived = [texture()]
    search.mockClear()
    openAsset.mockClear()
    openModelMaterial.mockClear()
    installFakeBridge({ assets: { search } })
    useAssets.setState({ items: [] })
  })

  /**
   * One line for what is one thing. A texture document of this studio IS a material, so three
   * pictures of a model are three channels of it — listed flat, they described three files where
   * the user sees one surface, and left the assembling to be done by hand in the other space.
   */
  it('shows a model’s maps as the one material they make up', async () => {
    derived = [texture(), texture({ id: 'asset-normal', map: 'normal' })]

    show()

    expect(await screen.findByText('Matière du modèle')).toBeInTheDocument()
    expect(screen.queryByText('Robot — Couleur de base')).not.toBeInTheDocument()
    // Which of the two is the SUBTITLE, and not merely that both are on screen: read the other
    // way round, both strings are still there and an assertion on their presence alone stays
    // green.
    expect(screen.getByText('Couleur de base, Normale')).toHaveClass('text-mini')
  })

  it('opens that material, channels in place, on the double-click every asset answers to', async () => {
    show()

    await userEvent.dblClick(await screen.findByRole('button', { name: /Ouvrir la matière/ }))

    expect(openModelMaterial).toHaveBeenCalledWith({ id: MODEL, name: 'Robot' }, derived)
  })

  // Blank underneath, the row read as an oversight — which is exactly what it is not.
  it('says why a picture the material could not take is on a line of its own', async () => {
    derived = [texture(), texture({ id: 'asset-packed', map: undefined, name: 'Robot — metal' })]

    show()

    expect(await screen.findByText('Robot — metal')).toBeInTheDocument()
    expect(screen.getByText('Cette image ne tient pas dans un seul canal')).toBeInTheDocument()
  })

  it('opens that picture where it is edited, since the material has no place for it', async () => {
    derived = [texture({ id: 'asset-packed', map: undefined, name: 'Robot — metal' })]

    show()

    await userEvent.dblClick(await screen.findByRole('button', { name: /Robot — metal/ }))

    expect(openAsset).toHaveBeenCalledWith(derived[0])
  })

  /**
   * The id of a picture does not move when ⌘S rewrites the file behind it, so the row draws its
   * URL off the stamp. A panel that only compared ids kept showing the picture from before the
   * edit — the very half of « edit it, and the model follows » this section exists for.
   */
  it('repaints a row whose picture was rewritten under the same id', async () => {
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
   * The whole reason the section is subscribed: extraction runs at import with nobody waiting on
   * it, so a model dropped in the scene has no picture at all for a second or two.
   */
  it('fills itself when the pictures land, without the model being picked again', async () => {
    derived = []

    show()

    expect(await screen.findByText(/Aucune image extraite/)).toBeInTheDocument()

    derived = [texture()]
    useAssets.setState({ items: [texture()] })

    expect(await screen.findByText('Matière du modèle')).toBeInTheDocument()
  })
})
