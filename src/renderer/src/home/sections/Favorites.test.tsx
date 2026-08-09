import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FavoriteRecipe } from '@shared/domain/favorite'
import { installFakeBridge } from '@/services/fake-bridge'
import { settleHome } from '../home-fixtures'
import { useFavorites } from '@/stores/favorites'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { Favorites } from './Favorites'

function recipe(overrides: Partial<FavoriteRecipe> = {}): FavoriteRecipe {
  return {
    id: 'favorite_1',
    label: 'FLUX.2',
    type: 'image',
    generation: {
      modelId: 'flux_2',
      modelLabel: 'FLUX.2',
      prompt: 'a mossy boulder',
      params: { width: 1024 },
    },
    pinnedAt: '2026-08-09T10:00:00.000Z',
    hasThumbnail: true,
    ...overrides,
  }
}

function install(recipes: readonly FavoriteRecipe[]) {
  const list = vi.fn(() => Promise.resolve([...recipes]))
  const unpin = vi.fn(() => Promise.resolve([]))
  installFakeBridge({ favorites: { list, unpin } })
  return { list, unpin }
}

beforeEach(() => {
  settleHome()
  useLayouts.setState({ home: true, activeWorkspace: 'video' })
  useModels.setState({ selected: {}, preset: {}, prepared: null })
  useFavorites.setState({ recipes: [], loaded: false })
})

describe('the recipes shelf', () => {
  /** The still is a copy on disk, served outside every project — never a URL that expires. */
  it('draws each recipe from the still kept beside it', async () => {
    install([recipe()])
    const { container } = render(<Favorites />)

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      'scenario://favorite/favorite_1',
    )
  })

  it('falls back to the glyph of its kind when no still was kept', async () => {
    install([recipe({ type: 'audio', hasThumbnail: false })])
    const { container } = render(<Favorites />)

    await screen.findByText('FLUX.2')
    expect(container.querySelector('img')).toBeNull()
  })

  it('runs the recipe again in the space that makes its kind', async () => {
    install([recipe()])
    render(<Favorites />)

    await userEvent.click(await screen.findByRole('button', { name: /En refaire une/ }))

    expect(useLayouts.getState().activeWorkspace).toBe('image')
    expect(useModels.getState().selected.image).toBe('flux_2')
    expect(useModels.getState().preset.image).toEqual({ width: 1024 })
  })

  it('drops a recipe from the shelf it stands on', async () => {
    const { unpin } = install([recipe()])
    render(<Favorites />)

    await userEvent.click(await screen.findByRole('button', { name: /Retirer/ }))

    expect(unpin).toHaveBeenCalledWith('favorite_1')
  })

  it('takes itself off when nothing has been pinned', async () => {
    const { list } = install([])
    const { container } = render(<Favorites />)

    await vi.waitFor(() => expect(list).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
