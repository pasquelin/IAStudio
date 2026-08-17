import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CloudAsset } from '@shared/domain/cloud-asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { useSettings } from '@/stores/settings'
import { settleHome } from '../../home-fixtures'
import { Explore } from './Explore'

function cloudAsset(overrides: Partial<CloudAsset> = {}): CloudAsset {
  return {
    id: 'cloud_1',
    name: 'boulder.png',
    type: 'image',
    remoteType: 'txt2img',
    ownerId: 'team_other',
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    privacy: 'public',
    tags: [],
    collectionIds: [],
    thumbnailUrl: 'https://cdn.example/thumb.png',
    width: 1024,
    height: 512,
    generation: { modelId: 'flux_2', modelLabel: 'FLUX.2', prompt: 'a boulder', params: {} },
    ...overrides,
  }
}

function install(assets: readonly CloudAsset[] = [cloudAsset()]) {
  const explore = vi.fn(() => Promise.resolve({ assets: [...assets], cursor: null }))
  installFakeBridge({ cloud: { explore } })
  return { explore }
}

beforeEach(() => {
  settleHome()
  useSettings.setState({ auth: { authenticated: true, ownerId: 'team_1' } })
})

describe('the explore band', () => {
  it('offers one tab per kind the studio knows', () => {
    install()
    render(<Explore />)

    expect(screen.getAllByRole('tab')).toHaveLength(6)
    expect(screen.getByRole('tab', { name: 'Image' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens on pictures, and asks the feed for those', async () => {
    const { explore } = install()
    render(<Explore />)

    await waitFor(() =>
      expect(explore).toHaveBeenCalledWith(expect.objectContaining({ type: 'image' })),
    )
  })

  it('asks for another kind when its tab is chosen', async () => {
    const { explore } = install()
    render(<Explore />)
    await waitFor(() => expect(explore).toHaveBeenCalled())

    await userEvent.click(screen.getByRole('tab', { name: 'Vidéo' }))

    await waitFor(() =>
      expect(explore).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'video' })),
    )
  })

  /**
   * The asset's own name, where this used to draw the model that made it: a band of model names
   * is a band where everything of one model reads the same, and a name says the thing.
   */
  it('captions each tile with what the asset is called', async () => {
    install()
    render(<Explore />)

    expect(await screen.findByText('boulder.png')).toBeInTheDocument()
  })

  it('asks the CDN for the width one column draws, and no more', async () => {
    // The column is 220 CSS pixels and jsdom reports a density of 1. On a Retina display the
    // same tile asks for 440 — the number follows the screen rather than a factor written here.
    install()
    const { container } = render(<Explore />)

    await waitFor(() =>
      expect(container.querySelector('img')?.getAttribute('src')).toBe(
        'https://cdn.example/thumb.png?width=220',
      ),
    )
  })

  it('says it is reading rather than announcing an empty feed it has not seen', () => {
    install([])
    render(<Explore />)

    // An initial state is not an answer: the round trip has not come back yet.
    expect(screen.getByText('Chargement du fil…')).toBeInTheDocument()
  })

  it('says the category is empty once the feed has actually answered', async () => {
    install([])
    render(<Explore />)

    expect(
      await screen.findByText('Rien de publié dans cette catégorie pour le moment.'),
    ).toBeInTheDocument()
  })
})
