import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { LIST_ONLY } from '@/helpers/collectionState'
import { useExplorerView } from '@/stores/explorer-view'
import { ExplorerActions } from './ExplorerActions'

beforeEach(() => useExplorerView.setState({ collection: LIST_ONLY, hidden: false, mode: 'folder' }))

describe('the explorer title row', () => {
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
   * The row carries the panel's name, these three and the way out. The search bar rode here
   * first and the screen settled it: the field measured 76 px on the home's left column, which
   * is « Rechercher… » cut to « Rech… ». It is drawn under the title now.
   */
  it('leaves the row to the three readings, and carries no field', () => {
    render(<ExplorerActions />)

    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
