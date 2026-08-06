import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModelPage, ModelQuery, ModelSummary } from '@shared/domain/model'
import { installFakeBridge } from '@/services/fake-bridge'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { DEFAULT_COLLECTION_STATE } from '@/design/collection-state'
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Models />
    </QueryClientProvider>,
  )
}

describe('Models panel', () => {
  beforeEach(() => {
    useSettings.setState({ auth: { authenticated: true } })
    useModels.setState({ selected: {}, collection: DEFAULT_COLLECTION_STATE })
    useLayouts.setState({ activeWorkspace: 'image' })
  })

  it('says what to do rather than showing an empty panel without credentials', () => {
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    installFakeBridge()
    renderPanel()

    expect(screen.getByText(/identifiants API/i)).toBeInTheDocument()
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

  it('tells an empty catalogue from a filter that matched nothing', async () => {
    installFakeBridge({
      scenario: { searchModels: () => Promise.resolve({ items: [], cursor: null }) },
    })

    const { rerender } = renderPanel()
    expect(await screen.findByText(/Aucun modèle dans cet espace/)).toBeInTheDocument()

    useModels.setState({ collection: { ...DEFAULT_COLLECTION_STATE, search: 'nothing' } })
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <Models />
      </QueryClientProvider>,
    )

    expect(await screen.findByText(/Aucun résultat pour ce filtre/)).toBeInTheDocument()
  })
})
