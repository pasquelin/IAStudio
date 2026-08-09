import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AssetCounts } from '@shared/domain/asset'
import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
import { TYPE_FACET } from '@/panels/assets/type-facet'
import { installFakeBridge } from '@/services/fake-bridge'
import { useAssets } from '@/stores/assets'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { ByMode } from './ByMode'

const NONE: AssetCounts = { image: 0, video: 0, audio: 0, mesh: 0, texture: 0, skybox: 0 }

const PROJECT = {
  path: '/projects/summer',
  manifest: {
    version: 1,
    name: 'Summer',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
}

function install(counts: Partial<AssetCounts>) {
  const read = vi.fn(() => Promise.resolve({ ...NONE, ...counts }))
  installFakeBridge({ assets: { counts: read } })
  return read
}

beforeEach(() => {
  useSettings.setState(state => ({
    settings: { ...state.settings, home: { enabled: true, sections: [...DEFAULT_HOME_SECTIONS] } },
  }))
  useProject.setState({ project: PROJECT })
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
