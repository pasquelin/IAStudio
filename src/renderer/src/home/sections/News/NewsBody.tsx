import { useTranslation } from 'react-i18next'
import type { NewsItem } from '@shared/domain/news'
import { Button } from '@/design/Button'
import { QuietNote } from '@/design/QuietNote'
import { useSettings } from '@/stores/settings'
import { NewsRow } from './NewsRow'
import { NewsSkeleton } from './NewsSkeleton'

/**
 * The states of one topic that have something to draw: switched off, still reading, empty, and
 * the rows. A refusal has none — `News` takes the whole band off the page for that one, which is
 * why this reads the items rather than the query.
 */
export function NewsBody({ items, reading }: { items?: readonly NewsItem[]; reading: boolean }) {
  const { t } = useTranslation()
  const setValue = useSettings(state => state.setValue)

  if (!reading) {
    return (
      <div className="flex flex-col items-start gap-2">
        <QuietNote>{t('home.news.off')}</QuietNote>
        <Button onClick={() => void setValue('home.news', true)}>{t('home.news.turnOn')}</Button>
      </div>
    )
  }

  if (!items) return <NewsSkeleton />

  if (items.length === 0) return <QuietNote>{t('home.news.none')}</QuietNote>

  return (
    <div className="flex flex-col">
      {items.map(item => (
        <NewsRow key={item.id} item={item} />
      ))}
    </div>
  )
}
