import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset, AssetQuery } from '@shared/domain/asset'
import { installFakeBridge } from '@/services/fake-bridge'
import { settleHome } from '../home-fixtures'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { connectPreparation } from '@/stores/preparation'
import { openFromHome } from '../open'
import type * as HomeOpenModule from '../open'
import { Creations } from './Creations'

// Where the asset lands is `ASSET_INTENTS`' business, and it needs open documents to have one.
// What this band answers for is which gesture it calls. Mocked at `home/open` rather than at the
// helper: the band loads the cascade on the click, to keep it out of the opening chunk.
vi.mock('../open', async importOriginal => ({
  ...(await importOriginal<typeof HomeOpenModule>()),
  openFromHome: vi.fn(),
}))

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
  settleHome()
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
   * "I click a thumbnail, there is some activity, but it does not open the file." Three shelves
   * drew the same square and did three different things with it, none of which was opening.
   * The tile opens now; recreating is the corner, and both say which is which by name.
   */
  describe('what a click on the picture does', () => {
    it('opens the asset rather than starting a generation', async () => {
      install([creation()])
      render(<Creations />)

      await userEvent.click(await screen.findByRole('button', { name: /Ouvrir.+boulder\.png/ }))

      expect(openFromHome).toHaveBeenCalledTimes(1)
      expect(vi.mocked(openFromHome).mock.calls[0]?.[0]).toMatchObject({ id: 'asset_1' })
    })

    /** The verb was in an `aria-label` only — heard by a reader, never seen by the eye. */
    it('names both actions, so neither has to be guessed from the picture', async () => {
      install([creation()])
      render(<Creations />)

      expect(await screen.findByRole('button', { name: /Ouvrir.+boulder\.png/ })).toBeVisible()
      expect(screen.getByRole('button', { name: 'En refaire une avec FLUX.2' })).toBeVisible()
    })
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
