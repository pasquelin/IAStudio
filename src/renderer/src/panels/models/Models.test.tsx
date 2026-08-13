import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelPage, ModelQuery, ModelSummary } from '@shared/domain/model'
import { withQueries } from '@/app/query-fixtures'
import { installFakeBridge } from '@/services/fake-bridge'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { preferModels } from '@/stores/settings-fixtures'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
import { Models } from './Models'

function model(id: string, overrides: Partial<ModelSummary> = {}): ModelSummary {
  return {
    id,
    name: `Model ${id}`,
    family: 'image',
    source: 'scenario',
    origin: 'official',
    featured: false,
    capabilities: ['txt2img'],
    tags: [],
    ...overrides,
  }
}

function renderPanel() {
  return render(withQueries(<Models />))
}

describe('Models panel', () => {
  beforeEach(() => {
    useSettings.setState({ auth: { authenticated: true } })
    // The panel reads the preference too, so a model preferred by one test would be shown as
    // chosen in the next.
    preferModels()
    useModels.setState({ selected: {}, collection: DEFAULT_COLLECTION_STATE })
    useLayouts.setState({ activeWorkspace: 'image' })
  })

  it('says what to do rather than showing an empty panel without credentials', () => {
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    installFakeBridge()
    renderPanel()

    expect(screen.getByText(/identifiants API/i)).toBeInTheDocument()
  })

  // Saying the key is missing without a way to type it leaves the user hunting through menus.
  it('leads to the account settings from the panel that reports the missing key', async () => {
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    const open = vi.fn(() => Promise.resolve())
    installFakeBridge({ settings: { open } })
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Configurer les identifiants' }))
    expect(open).toHaveBeenCalledWith('account')
  })

  it('asks only for the models of the active workspace', async () => {
    const searchModels = vi.fn((_query?: ModelQuery): Promise<ModelPage> =>
      Promise.resolve({ items: [], cursor: null }),
    )
    installFakeBridge({ scenario: { searchModels } })
    useLayouts.setState({ activeWorkspace: '3d' })

    renderPanel()

    await waitFor(() => expect(searchModels).toHaveBeenCalled())
    expect(searchModels.mock.calls[0]?.[0]).toMatchObject({ family: '3d' })
  })

  it('shows the models it received', async () => {
    installFakeBridge({
      scenario: {
        searchModels: () => Promise.resolve({ items: [model('flux'), model('veo')], cursor: null }),
      },
    })

    renderPanel()

    expect(await screen.findByText('Model flux')).toBeInTheDocument()
    expect(screen.getByText('Model veo')).toBeInTheDocument()
  })

  /**
   * The whole point of the paging: a first request must not walk the catalogue. The bridge is
   * asked for a bounded page and for the next one only when the list nears its end.
   */
  it('asks for a bounded page rather than the whole catalogue', async () => {
    const searchModels = vi.fn((_query?: ModelQuery): Promise<ModelPage> =>
      Promise.resolve({ items: [], cursor: null }),
    )
    installFakeBridge({ scenario: { searchModels } })

    renderPanel()

    await waitFor(() => expect(searchModels).toHaveBeenCalled())
    const limit = searchModels.mock.calls[0]?.[0]?.limit ?? 0
    expect(limit).toBeGreaterThan(0)
    expect(limit).toBeLessThanOrEqual(50)
  })

  it('follows the cursor to the next page as the end nears', async () => {
    const pages: ModelPage[] = [
      { items: [model('a')], cursor: 'l:public:1:token' },
      { items: [model('b')], cursor: null },
    ]
    const searchModels = vi.fn((query?: ModelQuery): Promise<ModelPage> =>
      Promise.resolve((query?.cursor ? pages[1] : pages[0]) ?? { items: [], cursor: null }),
    )
    installFakeBridge({ scenario: { searchModels } })

    renderPanel()

    expect(await screen.findByText('Model b')).toBeInTheDocument()
    expect(searchModels.mock.calls[1]?.[0]).toMatchObject({ cursor: 'l:public:1:token' })
  })

  /**
   * The registry bounds how many pages one request walks, so a selective filter answers an
   * empty page with a live cursor. Nothing scrolls then — the panel has to ask on its own, or
   * a workspace whose models sit late in the catalogue looks empty.
   */
  it('keeps walking when a page comes back empty but the cursor lives on', async () => {
    const pages: ModelPage[] = [
      { items: [], cursor: 'l:public:0:token' },
      { items: [model('late')], cursor: null },
    ]
    const searchModels = vi.fn((query?: ModelQuery): Promise<ModelPage> =>
      Promise.resolve((query?.cursor ? pages[1] : pages[0]) ?? { items: [], cursor: null }),
    )
    installFakeBridge({ scenario: { searchModels } })

    renderPanel()

    expect(await screen.findByText('Model late')).toBeInTheDocument()
  })

  /**
   * Pulling empty pages without a ceiling walks the whole catalogue the moment the panel
   * opens on a filter nothing matches — the exact freeze the paging exists to prevent.
   */
  it('stops pulling empty pages instead of walking the whole catalogue', async () => {
    const searchModels = vi.fn((): Promise<ModelPage> =>
      Promise.resolve({ items: [], cursor: 'l:public:0:more' }),
    )
    installFakeBridge({ scenario: { searchModels } })

    renderPanel()

    await waitFor(() => expect(searchModels.mock.calls.length).toBeGreaterThan(1))
    await waitFor(() =>
      expect(screen.getByText(/Aucun modèle dans cet espace/)).toBeInTheDocument(),
    )
    expect(searchModels.mock.calls.length).toBeLessThanOrEqual(8)
  })

  // Left on "loading" forever, a refused request looks like a panel that never finishes.
  it('says why it has nothing rather than loading forever', async () => {
    installFakeBridge({
      scenario: { searchModels: () => Promise.reject(new Error('rate-limited')) },
    })

    renderPanel()

    expect(await screen.findByText(/Trop de requêtes/)).toBeInTheDocument()
  })

  // The walk covers private models then public ones: the same model can arrive twice.
  it('shows a model once even when two pages carry it', async () => {
    const pages: ModelPage[] = [
      { items: [model('flux')], cursor: 'next' },
      { items: [model('flux')], cursor: null },
    ]
    installFakeBridge({
      scenario: {
        searchModels: query =>
          Promise.resolve((query?.cursor ? pages[1] : pages[0]) ?? { items: [], cursor: null }),
      },
    })

    renderPanel()

    await waitFor(() => expect(screen.getAllByText('Model flux')).toHaveLength(1))
  })

  /**
   * `thumbnail` is set on 160 of the 642 public models; the rest are pictured by an example
   * asset whose URL is signed and short-lived, so it is fetched when the card is seen.
   */
  it('resolves the example picture only for the cards that lack a thumbnail', async () => {
    const modelPreviews = vi.fn(() => Promise.resolve({}))
    installFakeBridge({
      scenario: {
        searchModels: () =>
          Promise.resolve({
            items: [
              model('bare', { previewAssetId: 'asset_bare' }),
              model('pictured', { thumbnail: 'https://cdn/x.png', previewAssetId: 'asset_x' }),
            ],
            cursor: null,
          }),
        modelPreviews,
      },
    })

    renderPanel()

    await waitFor(() => expect(modelPreviews).toHaveBeenCalled())
    expect(modelPreviews).toHaveBeenCalledWith(['asset_bare'])
  })

  it('remembers the chosen model per family', async () => {
    installFakeBridge({
      scenario: { searchModels: () => Promise.resolve({ items: [model('flux')], cursor: null }) },
    })

    renderPanel()
    await userEvent.click(await screen.findByText('Model flux'))

    expect(useModels.getState().selected.image).toBe('flux')
  })

  /**
   * The rail draws the generator off the preference alone, and the generator runs on it. This
   * panel said "no model chosen" about the very model the one beside it was running.
   */
  it('shows the preferred model as chosen where nothing was picked by hand', async () => {
    preferModels({ image: 'flux' })
    installFakeBridge({
      scenario: { searchModels: () => Promise.resolve({ items: [model('flux')], cursor: null }) },
    })

    renderPanel()

    // Twice: the header names it, and the grid lists it. Reading the session choice alone left
    // the header on "no model chosen" while the row below it was the model being generated with.
    expect(await screen.findAllByText('Model flux')).toHaveLength(2)
    expect(screen.queryByText('Aucun modèle choisi')).not.toBeInTheDocument()
  })

  it('tells an empty catalogue from a filter that matched nothing', async () => {
    installFakeBridge({
      scenario: { searchModels: () => Promise.resolve({ items: [], cursor: null }) },
    })

    const { rerender } = renderPanel()
    expect(await screen.findByText(/Aucun modèle dans cet espace/)).toBeInTheDocument()

    useModels.setState({ collection: { ...DEFAULT_COLLECTION_STATE, search: 'nothing' } })
    rerender(withQueries(<Models />))

    expect(await screen.findByText(/Aucun résultat pour ce filtre/)).toBeInTheDocument()
  })

  /**
   * Measured on this account: 41 of the first 100 public models are graded above `cu-basic`,
   * so picking one is the common case, not the edge one. The API answers 403
   * `ModelAccessRestrictedError` — the studio says so first instead.
   */
  describe('a model the plan does not cover', () => {
    /** Graded 50 against a plan worth 25, beside one graded 25 that the plan does cover. */
    beforeEach(() => {
      installFakeBridge({
        scenario: {
          searchModels: () =>
            Promise.resolve({
              items: [
                model('pro', { requiredPlanLevel: 50 }),
                model('mine', { requiredPlanLevel: 25 }),
              ],
              cursor: null,
            }),
          plan: () => Promise.resolve({ name: 'cu-basic', level: 25 }),
        },
      })
    })

    const cellOf = (name: string): HTMLElement | null =>
      screen.getByText(name).closest('[role="option"]')

    it('announces the row as disabled while leaving it listed', async () => {
      renderPanel()

      await screen.findByText('Model pro')
      expect(cellOf('Model pro')).toHaveAttribute('aria-disabled', 'true')
      expect(cellOf('Model mine')).not.toHaveAttribute('aria-disabled')
    })

    it('does not choose it when it is clicked', async () => {
      renderPanel()

      await userEvent.click(await screen.findByText('Model pro'))

      expect(useModels.getState().selected).toEqual({})
    })

    it('still chooses a model the plan does cover', async () => {
      renderPanel()

      await userEvent.click(await screen.findByText('Model mine'))

      expect(useModels.getState().selected).toMatchObject({ image: 'mine' })
    })

    /**
     * Greying a row out without a word is a dead end, and the two views say it in two places:
     * a card has a corner badge, a row explains through the tooltip on its name. Both are
     * tested because a user meets whichever view the panel was left in.
     */
    it('says why on a card, naming the plan that refuses it', async () => {
      renderPanel()

      const badge = await screen.findByText('Hors abonnement')
      expect(badge.getAttribute('data-tooltip-content')).toContain('cu-basic')
    })

    it('says why on a row too, where the badge has nowhere to sit', async () => {
      useModels.setState({ collection: { ...DEFAULT_COLLECTION_STATE, view: 'list' } })
      renderPanel()

      const title = await screen.findByText('Model pro')
      expect(title.getAttribute('data-tooltip-content')).toContain('cu-basic')
    })

    // Being wrong here hides models the user is paying for, so an unread plan refuses nothing.
    it('refuses nothing when the plan cannot be read', async () => {
      installFakeBridge({
        scenario: {
          searchModels: () =>
            Promise.resolve({ items: [model('pro', { requiredPlanLevel: 50 })], cursor: null }),
          plan: () => Promise.resolve(null),
        },
      })
      renderPanel()

      await screen.findByText('Model pro')
      expect(cellOf('Model pro')).not.toHaveAttribute('aria-disabled')
    })
  })
})
