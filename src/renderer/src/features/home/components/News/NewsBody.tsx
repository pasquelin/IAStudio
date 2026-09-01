import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { QuietNote } from '@/components/QuietNote'
import type { NewsQuery } from '@/hooks/useNews'
import { useSettings } from '@/stores/settings'
import { NewsRow } from './NewsRow'
import { NewsSkeleton } from './NewsSkeleton'

/**
 * The five states of one topic: switched off, reading, refused, empty, and the rows. The last
 * four are what a reader who PRESSED a chip sees — `News` only draws this band at all when it
 * has something to say, or when a chip made it the reader's own.
 */
export function NewsBody({ news, reading }: { news: NewsQuery; reading: boolean }) {
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

  if (news.isPending) return <NewsSkeleton />

  if (news.isError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <QuietNote>{t('home.news.refused')}</QuietNote>
        <Button onClick={() => void news.refetch()}>{t('home.retry')}</Button>
      </div>
    )
  }

  if (news.data.items.length === 0) return <QuietNote>{t('home.news.none')}</QuietNote>

  return (
    <div className="flex flex-col">
      {news.data.items.map(item => (
        <NewsRow key={item.id} item={item} />
      ))}
    </div>
  )
}
