import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { LIST_ONLY } from '@/helpers/collection-state'
import { useExplorerView } from '@/stores/explorer-view'
import { ExplorerActions } from './ExplorerActions'

beforeEach(() => useExplorerView.setState({ collection: LIST_ONLY, hidden: false, mode: 'folder' }))

describe('the explorer title row', () => {
  /**
   * The bar and the tree are two components — the bar rides in the panel's title row — so what
   * is typed here reaches the tree through the store and nowhere else.
   */
  it('hands what is typed to the panel', async () => {
    render(<ExplorerActions />)

    await userEvent.type(screen.getByRole('searchbox'), 'ruelle')

    expect(useExplorerView.getState().collection.search).toBe('ruelle')
  })

  it('turns the studio own files on and off', async () => {
    render(<ExplorerActions />)

    await userEvent.click(screen.getByRole('button', { name: 'Éléments cachés' }))
    expect(useExplorerView.getState().hidden).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: 'Éléments cachés' }))
    expect(useExplorerView.getState().hidden).toBe(false)
  })

  // Two readings of one folder, drawn as a pair: which one is on is what says the other exists.
  it('switches between the two readings of the folder', async () => {
    render(<ExplorerActions />)

    await userEvent.click(screen.getByRole('button', { name: 'Par domaine' }))
    expect(useExplorerView.getState().mode).toBe('domain')

    await userEvent.click(screen.getByRole('button', { name: 'Par dossier' }))
    expect(useExplorerView.getState().mode).toBe('folder')
  })

  /**
   * A tree has neither a grid nor thumbnails, and four buttons that would do nothing take the
   * width the search field needs in a side column.
   */
  it('offers no way to change an appearance a tree does not have', () => {
    render(<ExplorerActions />)

    expect(screen.queryByRole('button', { name: 'Icônes' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Agrandir les vignettes' })).toBeNull()
  })
})
