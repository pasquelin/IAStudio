import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAssetCounts, type AssetCounts } from '@shared/domain/asset'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
import { TYPE_FACET } from '@/panels/assets/type-facet'
import { installFakeBridge } from '@/services/fake-bridge'
import { HOME_PROJECT, settleHome } from '@/home/home-fixtures'
import { useAssets } from '@/stores/assets'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { Counts } from './Counts'

const NONE = emptyAssetCounts()

function install(counts: Partial<AssetCounts>) {
  const read = vi.fn(() => Promise.resolve({ ...NONE, ...counts }))
  installFakeBridge({ assets: { counts: read } })
  return read
}

beforeEach(() => {
  settleHome()
  useLayouts.setState({ home: true, activeWorkspace: 'image' })
  useAssets.setState({ collection: DEFAULT_COLLECTION_STATE, items: [], scope: null })
})

describe('the counts panel', () => {
  /**
   * The read is keyed on the open folder: another project is another set of totals, and a panel
   * that kept the first one's would describe a project one has just left.
   */
  it('counts again when another project is opened', async () => {
    const read = install({ image: 2 })
    useProject.setState({
      project: {
        path: '/projects/one',
        manifest: { version: 1, name: 'one', createdAt: '', updatedAt: '' },
      },
    })
    render(<Counts />)

    await screen.findByText('2')
    useProject.setState({
      project: {
        path: '/projects/two',
        manifest: { version: 1, name: 'two', createdAt: '', updatedAt: '' },
      },
    })

    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  })

  // The local catalogue rarely refuses, and an empty panel said nothing about it when it did.
  it('stays and offers to count again when the catalogue refuses', async () => {
    installFakeBridge({ assets: { counts: () => Promise.reject(new Error('locked')) } })
    render(<Counts />)

    expect(await screen.findByText(/n’a pas obtenu de réponse/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('asks the catalogue for totals rather than for the rows behind them', async () => {
    const read = install({ image: 12 })
    render(<Counts />)

    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(1)
  })

  /** Six of them, always: a counter that vanished at zero would read as a bug in the count. */
  it('keeps a kind the project has none of, and refuses the click', async () => {
    install({ image: 3 })
    render(<Counts />)

    await screen.findByText('3')
    expect(screen.getByRole('button', { name: /Vidéo/ })).toBeDisabled()
  })

  /**
   * `:hover` matches a disabled button — the click is refused, the pointer still lands. A count of
   * nothing therefore has to be told to `rowSkin`, or it lights up like a line one can press.
   */
  it('stops lighting up under the pointer once there is nothing to reveal', () => {
    install({ image: 3 })
    render(<Counts />)

    expect(screen.getByRole('button', { name: /Vidéo/ })).toHaveClass('hover:bg-transparent')
    expect(screen.getByRole('button', { name: /Vidéo/ })).not.toHaveClass('group/row')
  })

  /**
   * The label sits on `elevated` under a pointer, where `muted` reads 3.51:1. Lifted from the
   * row's group, exactly as a list row's subtitle is — one mechanism, not two.
   */
  it('lifts the kind out of muted while the pointer is on its line', async () => {
    install({ image: 3 })
    render(<Counts />)

    await screen.findByText('3')
    expect(screen.getByText('Image')).toHaveClass('text-muted', 'group-hover/row:text-text')
  })

  /**
   * All six at zero rather than an empty panel, with a folder open or without one: the numbers
   * ARE the answer, and they say the project has been counted rather than not yet read. A band
   * could take itself off the page; a column standing under a rail icon cannot.
   */
  it.each([
    ['a project open', HOME_PROJECT],
    ['no project at all', null],
  ])('draws the six kinds at zero with %s', async (_case, project) => {
    const read = install({})
    settleHome(project)
    render(<Counts />)

    await vi.waitFor(() => expect(read).toHaveBeenCalled())
    expect(screen.getAllByText('0')).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Image/ })).toBeDisabled()
  })

  /**
   * The click leaves the home for the space that makes the kind, and narrows the shelf to it.
   * No document is created on the way: looking is not starting something new.
   */
  it('narrows the shelf to the kind and leaves the home', async () => {
    install({ skybox: 4 })
    render(<Counts />)

    await userEvent.click(await screen.findByRole('button', { name: /Skybox/ }))

    expect(useLayouts.getState().activeWorkspace).toBe('skyboxes')
    expect(useLayouts.getState().home).toBe(false)
    expect(useAssets.getState().collection.selections[TYPE_FACET]).toEqual(['skybox'])
  })
})
