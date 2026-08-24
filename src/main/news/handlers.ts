import { isNewsTopic } from '@shared/domain/news'
import { CHANNELS } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import type { NewsService } from './newsStore'

export function registerNewsHandlers(news: NewsService): void {
  // Checked rather than trusted: the topic keys a URL, and a window that named an unknown one
  // would have it composed into a request to the hub.
  handle(CHANNELS.newsRead, (_event, topic) => {
    if (!isNewsTopic(topic)) throw new Error(`not a news topic: ${String(topic)}`)

    return news.page(topic)
  })
}
