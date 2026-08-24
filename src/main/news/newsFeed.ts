import { unescapeXml } from '@shared/domain/xmlText'
import { NEWS_PAGE_SIZE, type NewsItem } from '@shared/domain/news'
import { isRecord } from '@shared/guards'

/**
 * Where the two sources live. The same host every weight of the catalogue is fetched from —
 * 546 file URLs on 2026-08-24 — so reading them tells no party anything it is not already told.
 */
const HUB = 'https://huggingface.co'

/** One tag's page, trending first. `full=false` keeps the payload to what a row shows. */
export function modelsUrl(tag: string, limit = NEWS_PAGE_SIZE): string {
  const query = new URLSearchParams({
    pipeline_tag: tag,
    sort: 'trendingScore',
    direction: '-1',
    limit: String(limit),
  })

  return `${HUB}/api/models?${query.toString()}`
}

export const ARTICLES_URL = `${HUB}/blog/feed.xml`

function textOf(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function countOf(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * What the hub answered, as rows. A malformed entry is DROPPED rather than defaulted: a card
 * with no address is a card nothing can be done with, and the list is somebody else's data.
 */
export function modelsFrom(body: string): NewsItem[] {
  const parsed: unknown = JSON.parse(body)
  if (!Array.isArray(parsed)) return []

  return parsed.flatMap(entry => {
    if (!isRecord(entry)) return []
    const id = textOf(entry.id ?? entry.modelId)
    if (id === null) return []

    return [
      {
        id,
        // The publisher's own name for it, which is what a reader recognises.
        title: id,
        url: `${HUB}/${id}`,
        publishedAt: textOf(entry.createdAt),
        kind: textOf(entry.pipeline_tag),
        downloads: countOf(entry.downloads),
        likes: countOf(entry.likes),
      },
    ]
  })
}

/** The trending order the hub answered in, kept across a merge of several tags. */
export function mergedModels(pages: readonly (readonly NewsItem[])[]): NewsItem[] {
  const byId = new Map<string, NewsItem>()
  // Round by round rather than page after page: two tags of one family each contribute their
  // first row before either contributes its second, which is what "trending" means across them.
  const depth = Math.max(0, ...pages.map(page => page.length))
  for (let rank = 0; rank < depth; rank += 1) {
    for (const page of pages) {
      const item = page[rank]
      if (item && !byId.has(item.id)) byId.set(item.id, item)
    }
  }

  return [...byId.values()].slice(0, NEWS_PAGE_SIZE)
}

const ITEM = /<item\b[^>]*>([\s\S]*?)<\/item>/g

/**
 * One element's text, CDATA unwrapped. No parser and none needed: this reads four known element
 * names out of an RSS 2.0 item, which is the same bargain `xmlText.ts` already struck.
 */
function element(item: string, name: string): string | null {
  const found = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`).exec(item)?.[1]
  if (found === undefined) return null

  const text = unescapeXml(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(found)?.[1] ?? found).trim()

  return text.length > 0 ? text : null
}

/** An RSS date as ISO, or `null` — a date that will not parse is not a date to show. */
function dateOf(value: string | null): string | null {
  if (value === null) return null
  const stamp = Date.parse(value)

  return Number.isNaN(stamp) ? null : new Date(stamp).toISOString()
}

/**
 * The blog feed, as rows. HTTPS only, and that is not decoration: the renderer opens these
 * through `setWindowOpenHandler`, which drops anything else without a word — so a row that
 * could never open is dropped here instead, where it can be counted.
 */
export function articlesFrom(body: string): NewsItem[] {
  return [...body.matchAll(ITEM)].flatMap(match => {
    const item = match[1] ?? ''
    const url = element(item, 'link')
    const title = element(item, 'title')
    if (url === null || title === null || !url.startsWith('https://')) return []

    return [
      {
        id: url,
        title,
        url,
        publishedAt: dateOf(element(item, 'pubDate')),
        kind: null,
        downloads: null,
        likes: null,
      },
    ]
  })
}
