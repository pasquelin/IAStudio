import {
  ARTICLES_TOPIC,
  NEWS_TAGS_BY_FAMILY,
  type NewsItem,
  type NewsPage,
  type NewsTopic,
} from '@shared/domain/news'
import { log } from '@main/log'
import {
  ARTICLES_URL,
  articlesFrom,
  mergedModels,
  modelsFrom,
  modelsUrl,
  recentOf,
} from './newsFeed'

/** What a body comes back through. Injected so no test of this file reaches the network. */
type NewsReader = (url: string, signal: AbortSignal) => Promise<string>

export type NewsDependencies = {
  read: NewsReader
  /** Injected for the same reason: a cache with a TTL is untestable against a moving clock. */
  now: () => number
}

/**
 * How long an answer stands. Six hours rather than a session: a studio left open for a week
 * would show a week-old list, and rather than a minute — these are trends, not a ticker.
 */
export const NEWS_TTL_MS = 6 * 60 * 60 * 1000

/** What one request may take before it is abandoned. The band is decoration; nothing waits. */
const REQUEST_MS = 8000

export type NewsService = {
  /** The topic's rows, from the cache while it is fresh. Rejects when the source refused. */
  page: (topic: NewsTopic) => Promise<NewsPage>
}

async function itemsFor(topic: NewsTopic, read: NewsReader, now: number): Promise<NewsItem[]> {
  const signal = AbortSignal.timeout(REQUEST_MS)
  // The feed carries five hundred items, and the models walk is capped by the request itself:
  // this is the ONE side that had nothing bounding it, which put forty-four rows on the home.
  if (topic === ARTICLES_TOPIC) {
    return recentOf(articlesFrom(await read(ARTICLES_URL, signal)), now)
  }

  const tags = NEWS_TAGS_BY_FAMILY[topic] ?? []
  const pages = await Promise.all(tags.map(tag => read(modelsUrl(tag), signal).then(modelsFrom)))

  return mergedModels(pages)
}

/**
 * The news, cached per topic and shared by every window.
 *
 * 🛑 The in-flight promise is cached too, not only the answer: the home of a second window opens
 * on the same topic, and two requests for one list is the hub asked twice for nothing.
 */
export function createNewsService({ read, now }: NewsDependencies): NewsService {
  const held = new Map<NewsTopic, { at: number; page: NewsPage }>()
  const flying = new Map<NewsTopic, Promise<NewsPage>>()

  const fetchTopic = async (topic: NewsTopic): Promise<NewsPage> => {
    try {
      const page: NewsPage = {
        topic,
        items: await itemsFor(topic, read, now()),
        readAt: new Date(now()).toISOString(),
      }
      held.set(topic, { at: now(), page })

      return page
    } catch (failure) {
      log.warn('news', `${topic} did not answer: ${String(failure)}`)
      throw failure
    } finally {
      flying.delete(topic)
    }
  }

  return {
    page: topic => {
      const fresh = held.get(topic)
      if (fresh && now() - fresh.at < NEWS_TTL_MS) return Promise.resolve(fresh.page)

      const already = flying.get(topic)
      if (already) return already

      const request = fetchTopic(topic)
      flying.set(topic, request)

      return request
    },
  }
}
