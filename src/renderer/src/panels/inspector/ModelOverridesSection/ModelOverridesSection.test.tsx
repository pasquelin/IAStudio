import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import type { ModelRef } from '@shared/domain/scene'
import { installFakeBridge } from '@/services/fakeBridge'
import { ModelOverridesSection } from './ModelOverridesSection'

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

let derived: Asset[] = []
const search = vi.fn((query: AssetQuery) =>
  Promise.resolve(query.derivedFrom === MODEL ? derived : []),
)

const onChange = vi.fn()

function showFolded(textures: ModelRef['textures'] = undefined): void {
  render(
    <ModelOverridesSection
      assetId={MODEL}
      textures={textures}
      onChange={onChange}
      onFinish={() => {}}
    />,
  )
}

async function unfold(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Remplacer un canal' }))
}

const reuse = (): Promise<HTMLElement> =>
  screen.findByRole('button', { name: /Reprendre les images/ })

describe('ModelOverridesSection', () => {
  beforeEach(() => {
    derived = [texture()]
    search.mockClear()
    onChange.mockClear()
    installFakeBridge({ assets: { search } })
  })

  /**
   * The link « edit the picture and the model follows » hangs on: a model otherwise wears the
   * pictures baked into its own file, which no edit of the project can reach.
   */
  it('points every slot at the picture the model was extracted into', async () => {
    derived = [texture(), texture({ id: 'asset-normal', map: 'normal' })]

    showFolded()
    await unfold()
    await userEvent.click(await reuse())

    expect(onChange).toHaveBeenCalledWith({
      map: { assetId: 'asset-base' },
      normalMap: { assetId: 'asset-normal' },
    })
  })

  // A packed picture names no channel, and a height map names one no scene slot reads.
  it('leaves out a picture no slot of a scene reads', async () => {
    derived = [
      texture(),
      texture({ id: 'asset-height', map: 'height' }),
      texture({ id: 'asset-packed', map: undefined }),
    ]

    showFolded()
    await unfold()
    await userEvent.click(await reuse())

    expect(onChange).toHaveBeenCalledWith({ map: { assetId: 'asset-base' } })
  })

  // Offered against nothing to fill, the press would empty the slots a hand had filled.
  it('offers nothing when no picture of the model dresses a slot', async () => {
    derived = [texture({ id: 'asset-packed', map: undefined })]

    showFolded()
    await unfold()

    expect(screen.queryByRole('button', { name: /Reprendre les images/ })).not.toBeInTheDocument()
  })

  /**
   * Two materials, two base colours, and this document has no name to hang a per-material
   * override on — picking either would repaint both, silently and by catalogue order.
   */
  it('refuses to choose when two pictures claim the same slot', async () => {
    derived = [texture(), texture({ id: 'asset-second-base' })]

    showFolded()
    await unfold()

    expect(screen.queryByRole('button', { name: /Reprendre les images/ })).not.toBeInTheDocument()
  })

  // The fold unmounts, so a panel nobody opened must not have asked the catalogue anything.
  it('asks the catalogue nothing while it is folded', () => {
    showFolded()

    expect(search).not.toHaveBeenCalled()
  })

  /**
   * Extraction labels four channels at most, so a hand fills the rest — and the press promises to
   * point the model's own channels, not to clear the others.
   */
  it('lands over the slots a hand has filled rather than instead of them', async () => {
    showFolded({ roughnessMap: { assetId: 'asset-hand-picked' } })
    await unfold()
    await userEvent.click(await reuse())

    expect(onChange).toHaveBeenCalledWith({
      roughnessMap: { assetId: 'asset-hand-picked' },
      map: { assetId: 'asset-base' },
    })
  })
})
