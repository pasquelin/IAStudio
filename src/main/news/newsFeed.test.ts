import { describe, expect, it } from 'vitest'
import { NEWS_PAGE_SIZE } from '@shared/domain/news'
import {
  articlesFrom,
  mergedModels,
  modelsFrom,
  modelsUrl,
  NEWS_WINDOW_MS,
  recentOf,
} from './newsFeed'

describe('the hub request', () => {
  it('asks for one pipeline, trending first', () => {
    const url = new URL(modelsUrl('text-to-image', 4))

    expect(url.origin).toBe('https://huggingface.co')
    expect(url.searchParams.get('pipeline_tag')).toBe('text-to-image')
    expect(url.searchParams.get('sort')).toBe('trendingScore')
    expect(url.searchParams.get('limit')).toBe('4')
  })
})

describe('what the hub answered', () => {
  // Shaped on what `?pipeline_tag=text-to-image` returned on 2026-08-24.
  const body = JSON.stringify([
    {
      id: 'black-forest-labs/FLUX.1-dev',
      pipeline_tag: 'text-to-image',
      downloads: 649588,
      likes: 14230,
      createdAt: '2024-07-31T21:13:44.000Z',
    },
  ])

  it('reads a row, and the address it opens', () => {
    expect(modelsFrom(body)).toEqual([
      {
        id: 'black-forest-labs/FLUX.1-dev',
        title: 'black-forest-labs/FLUX.1-dev',
        url: 'https://huggingface.co/black-forest-labs/FLUX.1-dev',
        publishedAt: '2024-07-31T21:13:44.000Z',
        kind: 'text-to-image',
        downloads: 649588,
        likes: 14230,
      },
    ])
  })

  /** Somebody else's data: an entry with no id is a card with nothing to open. */
  it('drops an entry it could not address rather than inventing one', () => {
    expect(modelsFrom(JSON.stringify([{ likes: 3 }, 'not an object'])).length).toBe(0)
  })

  it('says nothing at all when the answer was not a list', () => {
    expect(modelsFrom('{"error":"nope"}')).toEqual([])
  })

  /**
   * Two tags of one family, and trending is what the merge has to keep: taking one page whole
   * before the other would put the third 3D-from-text model above the first 3D-from-image one.
   */
  it('interleaves several tags rather than stacking them', () => {
    const page = (prefix: string) =>
      [1, 2].map(rank => ({
        id: `${prefix}${rank}`,
        title: `${prefix}${rank}`,
        url: `https://huggingface.co/${prefix}${rank}`,
        publishedAt: null,
        kind: null,
        downloads: null,
        likes: null,
      }))

    expect(mergedModels([page('a'), page('b')]).map(item => item.id)).toEqual([
      'a1',
      'b1',
      'a2',
      'b2',
    ])
  })

  it('lists a model once when two tags both answered with it', () => {
    const one = [
      {
        id: 'shared',
        title: 'shared',
        url: 'https://huggingface.co/shared',
        publishedAt: null,
        kind: null,
        downloads: null,
        likes: null,
      },
    ]

    expect(mergedModels([one, one])).toHaveLength(1)
  })
})

describe('the blog feed', () => {
  const feed = `<?xml version="1.0"?><rss><channel>
    <item>
      <title><![CDATA[Up to 3.2x Faster Inference]]></title>
      <link>https://huggingface.co/blog/faster</link>
      <pubDate>Thu, 20 Aug 2026 16:52:57 GMT</pubDate>
    </item>
    <item>
      <title>Measuring &amp; benchmarking</title>
      <link>https://huggingface.co/blog/measuring</link>
    </item>
  </channel></rss>`

  it('reads a title out of CDATA and an entity out of the other', () => {
    expect(articlesFrom(feed).map(item => item.title)).toEqual([
      'Up to 3.2x Faster Inference',
      'Measuring & benchmarking',
    ])
  })

  it('states the date as ISO, and nothing where the item carried none', () => {
    const [first, second] = articlesFrom(feed)

    expect(first?.publishedAt).toBe('2026-08-20T16:52:57.000Z')
    expect(second?.publishedAt).toBeNull()
  })

  /**
   * `setWindowOpenHandler` hands HTTPS to the system and denies the rest without a word, so a
   * row that could never open is dropped here — where it can at least be counted.
   */
  it('drops an item the studio could never open', () => {
    const insecure = feed.replace('https://huggingface.co/blog/faster', 'http://example.invalid')

    expect(articlesFrom(insecure).map(item => item.url)).toEqual([
      'https://huggingface.co/blog/measuring',
    ])
  })

  it('answers nothing on a body that is not a feed', () => {
    expect(articlesFrom('<html><body>404</body></html>')).toEqual([])
  })
})

describe('what a band is allowed to show', () => {
  const NOW = Date.parse('2026-08-24T00:00:00.000Z')

  const aged = (days: number) => ({
    id: `d${days}`,
    title: `d${days}`,
    url: `https://huggingface.co/blog/d${days}`,
    publishedAt: new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString(),
    kind: null,
    downloads: null,
    likes: null,
  })

  /**
   * The defect this closes: the blog feed carries five hundred items, and nothing capped the
   * articles side — forty-four rows landed on the home, a page of their own.
   */
  it('shows no more rows than one band holds', () => {
    expect(
      recentOf(
        Array.from({ length: 40 }, (_unused, rank) => aged(rank)),
        NOW,
      ),
    ).toHaveLength(NEWS_PAGE_SIZE)
  })

  it('drops what is older than a month: past that it is history, not news', () => {
    const kept = recentOf([aged(2), aged(40)], NOW)

    expect(kept.map(item => item.id)).toEqual(['d2'])
  })

  it('keeps the edge of the window rather than cutting it', () => {
    expect(recentOf([aged(NEWS_WINDOW_MS / (24 * 60 * 60 * 1000) - 1)], NOW)).toHaveLength(1)
  })

  /** Nothing here can judge an item that stated no date, and inventing one to compare is worse. */
  it('keeps an item that stated no date at all', () => {
    expect(recentOf([{ ...aged(0), publishedAt: null }], NOW)).toHaveLength(1)
  })
})
