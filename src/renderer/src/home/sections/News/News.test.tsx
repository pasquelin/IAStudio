import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NEWS_PAGE_SIZE, type NewsItem, type NewsPage } from '@shared/domain/news'
import { withQueries } from '@/app/query-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { useSettings } from '@/stores/settings'
import { settleHome } from '../../home-fixtures'
import { News } from './News'

const item = (over: Partial<NewsItem> = {}): NewsItem => ({
  id: 'black-forest-labs/FLUX.1-dev',
  title: 'black-forest-labs/FLUX.1-dev',
  url: 'https://huggingface.co/black-forest-labs/FLUX.1-dev',
  publishedAt: '2026-08-20T16:52:57.000Z',
  kind: 'text-to-image',
  downloads: 649588,
  likes: 14230,
  ...over,
})

function show(items: readonly NewsItem[] = [item()]) {
  const read = vi.fn(
    (topic: string): Promise<NewsPage> =>
      Promise.resolve({ topic, items: [...items], readAt: '2026-08-24T00:00:00.000Z' }) as never,
  )
  installFakeBridge({ news: { read } })
  render(withQueries(<News />))

  return { read }
}

beforeEach(() => {
  settleHome()
})

describe('the news band', () => {
  it('offers one chip per family the hub publishes, plus the articles', () => {
    show()

    // Texture and Skybox are deliberately absent: nothing publishes them as a pipeline, so a
    // chip for either would list the Image one again under another name.
    expect(screen.getAllByRole('button', { pressed: false }).length).toBeGreaterThan(0)
    for (const label of ['Image', 'Vidéo', '3D', 'Audio', 'Articles']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: 'Texture' })).not.toBeInTheDocument()
  })

  it('opens on the first family, and asks the hub for it', async () => {
    const { read } = show()

    expect(await screen.findByText('black-forest-labs/FLUX.1-dev')).toBeInTheDocument()
    expect(read).toHaveBeenCalledWith('image')
  })

  it('asks for another topic when its chip is chosen', async () => {
    const { read } = show()
    await screen.findByText('black-forest-labs/FLUX.1-dev')

    await userEvent.click(screen.getByRole('button', { name: 'Articles' }))

    expect(read).toHaveBeenLastCalledWith('articles')
  })

  /** These pages belong to somebody else: the row is a link the browser opens, not a button. */
  it('draws each row as an outward link', async () => {
    show()

    const link = await screen.findByRole('link')
    expect(link).toHaveAttribute('href', 'https://huggingface.co/black-forest-labs/FLUX.1-dev')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('says how many times a model was taken, in the reader s own digits', async () => {
    show()

    expect(await screen.findByText(/téléchargements/)).toBeInTheDocument()
  })

  /**
   * The page jumped: a one-line note under a band that then grew to eight rows moved everything
   * below it. The waiting state reserves the room the rows will take.
   */
  it('reserves the height of a full band while it waits', () => {
    // A read that never answers: the band stays on its waiting state for the whole case.
    installFakeBridge({ news: { read: () => new Promise(() => {}) } })
    render(withQueries(<News />))

    expect(screen.getByRole('heading', { name: 'Ce qui bouge' })).toBeInTheDocument()
    expect(document.querySelectorAll('[aria-hidden="true"] > span')).toHaveLength(NEWS_PAGE_SIZE)
  })

  /** Emptied first, the band collapses and the whole page jumps up, then back down. */
  it('keeps the rows of the topic just left while the next one is read', async () => {
    show()
    await screen.findByText('black-forest-labs/FLUX.1-dev')

    await userEvent.click(screen.getByRole('button', { name: 'Articles' }))

    expect(screen.getByText('black-forest-labs/FLUX.1-dev')).toBeInTheDocument()
  })

  it('says the source refused rather than showing an empty category', async () => {
    installFakeBridge({ news: { read: () => Promise.reject(new Error('502')) } })
    render(withQueries(<News />))

    expect(await screen.findByText('La source n’a pas répondu.')).toBeInTheDocument()
  })

  it('says a category is empty once the hub has actually answered', async () => {
    show([])

    expect(await screen.findByText('Rien à signaler dans cette catégorie.')).toBeInTheDocument()
  })

  /**
   * 🛑 The one outward call the studio makes for something other than a model or a job. Cut, it
   * asks for nothing at all — and the band says so rather than going missing, since a band that
   * vanishes is a setting whose only symptom is a shelf that stopped appearing.
   */
  it('reads nothing at all while the setting is off, and offers to turn it on', () => {
    useSettings.setState(state => ({
      settings: { ...state.settings, home: { ...state.settings.home, news: false } },
    }))
    const { read } = show()

    expect(screen.getByText(/Les actualit\u00e9s sont coup\u00e9es/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Les activer' })).toBeInTheDocument()
    expect(read).not.toHaveBeenCalled()
  })
})
