import { describe, expect, it, vi } from 'vitest'
import { ARTICLES_TOPIC, NEWS_PAGE_SIZE } from '@shared/domain/news'
import { NEWS_WINDOW_MS } from './newsFeed'
import { createNewsService, NEWS_TTL_MS } from './newsStore'

const ONE_MODEL = JSON.stringify([{ id: 'a/b', downloads: 1, likes: 2 }])

/** Fifty items every other day — sixteen of them inside the window, which is what caps. */
const LONG_FEED = `<rss><channel>${Array.from({ length: 50 }, (_unused, rank) => {
  const at = new Date(Date.UTC(2026, 7, 24) - rank * 2 * 24 * 60 * 60 * 1000).toUTCString()
  return `<item><title>a${rank}</title><link>https://huggingface.co/blog/a${rank}</link><pubDate>${at}</pubDate></item>`
}).join('')}</channel></rss>`

function service(read = vi.fn(() => Promise.resolve(ONE_MODEL))) {
  let clock = 0

  return {
    read,
    news: createNewsService({ read, now: () => clock }),
    pass: (ms: number) => {
      clock += ms
    },
  }
}

describe('the news service', () => {
  it('reads one request per tag a family declares', async () => {
    const { read, news } = service()

    // 3D is the family with two tags: image-to-3d and text-to-3d.
    await news.page('3d')

    expect(read).toHaveBeenCalledTimes(2)
  })

  it('holds an answer rather than asking again', async () => {
    const { read, news } = service()

    await news.page('image')
    await news.page('image')

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('asks again once the answer is older than its life', async () => {
    const { read, news, pass } = service()

    await news.page('image')
    pass(NEWS_TTL_MS + 1)
    await news.page('image')

    expect(read).toHaveBeenCalledTimes(2)
  })

  /**
   * A second window opening on the same band is the case: two requests for one list is the hub
   * asked twice for nothing, and the second answer would overwrite the first for no gain.
   */
  it('folds two callers waiting on the same topic into one request', async () => {
    const { read, news } = service()

    await Promise.all([news.page('image'), news.page('image')])

    expect(read).toHaveBeenCalledTimes(1)
  })

  /**
   * The articles side had nothing bounding it — the models walk is capped by the request itself —
   * so forty-four rows of a five-hundred-item feed landed on the home.
   */
  it('bounds the articles to a month and to what one band holds', async () => {
    const clock = Date.UTC(2026, 7, 24)
    const news = createNewsService({ read: () => Promise.resolve(LONG_FEED), now: () => clock })

    const page = await news.page(ARTICLES_TOPIC)

    expect(page.items).toHaveLength(NEWS_PAGE_SIZE)
    for (const item of page.items) {
      expect(Date.parse(item.publishedAt ?? '')).toBeGreaterThanOrEqual(clock - NEWS_WINDOW_MS)
    }
  })

  it('lets a refusal through, so the band can tell silence from an empty list', async () => {
    const { news } = service(vi.fn(() => Promise.reject(new Error('502'))))

    await expect(news.page(ARTICLES_TOPIC)).rejects.toThrow('502')
  })

  /** A refusal must not be remembered as an answer: the next look has to try again. */
  it('asks again after a refusal rather than holding it', async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('502'))
      .mockResolvedValue(ONE_MODEL)
    const { news } = service(read)

    await expect(news.page('image')).rejects.toThrow()
    await news.page('image')

    expect(read).toHaveBeenCalledTimes(2)
  })
})
