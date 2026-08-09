import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import { DEFAULT_HOME_SECTIONS } from '@shared/domain/home'
import { installFakeBridge } from '@/services/fake-bridge'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { connectPreparation } from '@/stores/preparation'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { Creations } from './Creations'

const PROJECT = {
  path: '/projects/summer',
  manifest: {
    version: 1,
    name: 'Summer',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
}

function creation(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset_1',
    name: 'boulder.png',
    type: 'image',
    location: 'local',
    tags: [],
    createdAt: '2026-08-08T10:00:00.000Z',
    generation: {
      modelId: 'flux_2',
      modelLabel: 'FLUX.2',
      prompt: 'a mossy boulder',
      params: { prompt: 'a mossy boulder', width: 1024 },
    },
    ...overrides,
  }
}

function install(assets: readonly Asset[]) {
  const search = vi.fn((_query: AssetQuery) => Promise.resolve([...assets]))
  installFakeBridge({ assets: { search } })
  return search
}

beforeEach(() => {
  useSettings.setState(state => ({
    settings: { ...state.settings, home: { enabled: true, sections: [...DEFAULT_HOME_SECTIONS] } },
  }))
  useProject.setState({ project: PROJECT })
  useLayouts.setState({ home: true, activeWorkspace: 'video' })
  useModels.setState({ selected: {}, preset: {}, prepared: null })
})

describe('the creations shelf', () => {
  it('asks the catalogue for what was generated, and nothing else', async () => {
    const search = install([creation()])
    render(<Creations />)

    await screen.findByText('FLUX.2')
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ generated: true }))
  })

  /** The model, not the file name — it is what one hunts a look down by, as on scenario.com. */
  it('captions each tile with the model that made it', async () => {
    install([creation()])
    render(<Creations />)

    expect(await screen.findByText('FLUX.2')).toBeInTheDocument()
    expect(screen.queryByText('boulder.png')).not.toBeInTheDocument()
  })

  it('draws nothing at all when the project has produced nothing', async () => {
    const search = install([])
    const { container } = render(<Creations />)

    await vi.waitFor(() => expect(search).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  /**
   * The point of the whole shelf: the model, the prompt and the parameters are already in the
   * catalogue, so recreating costs no request — and it still works with the network down.
   */
  it('fills the generator from the catalogue alone, without a single request', async () => {
    install([creation()])
    render(<Creations />)

    await userEvent.click(await screen.findByRole('button', { name: /FLUX\.2/ }))

    const models = useModels.getState()
    expect(models.selected.image).toBe('flux_2')
    expect(models.preset.image).toEqual({ prompt: 'a mossy boulder', width: 1024 })
  })

  /**
   * Recreating leaves the home for the space that makes this kind — and `connectPreparation`
   * drops any preparation when the workspace changes. Preparing before the move would arm the
   * generator and immediately disarm it.
   */
  it('leaves for the space that makes the kind, keeping the preparation', async () => {
    install([
      creation({
        type: 'audio',
        generation: { modelId: 'music_2', modelLabel: 'Music v2', prompt: 'a drone', params: {} },
      }),
    ])
    // Live, as it is in the app: it is what drops a preparation on a change of workspace, and
    // therefore what makes the order of the two writes observable.
    const stop = connectPreparation()
    render(<Creations />)

    await userEvent.click(await screen.findByRole('button', { name: /Music v2/ }))
    stop()

    expect(useLayouts.getState().activeWorkspace).toBe('audio')
    expect(useLayouts.getState().home).toBe(false)
    expect(useModels.getState().selected.audio).toBe('music_2')
  })
})
