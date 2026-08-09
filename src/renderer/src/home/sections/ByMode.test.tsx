import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAssetCounts, type AssetCounts } from '@shared/domain/asset'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
import { TYPE_FACET } from '@/panels/assets/type-facet'
import { installFakeBridge } from '@/services/fake-bridge'
import { settleHome } from '../home-fixtures'
import { useAssets } from '@/stores/assets'
import { useLayouts } from '@/stores/layouts'
import { ByMode } from './ByMode'

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

describe('the counters', () => {
  it('asks the catalogue for totals rather than for the rows behind them', async () => {
    const read = install({ image: 12 })
    render(<ByMode />)

    expect(await screen.findByText('12')).toBeInTheDocument()
    expect(read).toHaveBeenCalledTimes(1)
  })

  /** Six of them, always: a counter that vanished at zero would read as a bug in the count. */
  it('keeps a kind the project has none of, and refuses the click', async () => {
    install({ image: 3 })
    render(<ByMode />)

    await screen.findByText('3')
    expect(screen.getByRole('button', { name: /Vidéo/ })).toBeDisabled()
  })

  it('draws nothing at all on a project that holds nothing', async () => {
    const read = install({})
    const { container } = render(<ByMode />)

    await vi.waitFor(() => expect(read).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * The click leaves the home for the space that makes the kind, and narrows the shelf to it.
   * No document is created on the way: looking is not starting something new.
   */
  it('narrows the shelf to the kind and leaves the home', async () => {
    install({ skybox: 4 })
    render(<ByMode />)

    await userEvent.click(await screen.findByRole('button', { name: /Skybox/ }))

    expect(useLayouts.getState().activeWorkspace).toBe('skyboxes')
    expect(useLayouts.getState().home).toBe(false)
    expect(useAssets.getState().collection.selections[TYPE_FACET]).toEqual(['skybox'])
  })
})
