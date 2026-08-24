import { useTranslation } from 'react-i18next'
import type { NewsTopic } from '@shared/domain/news'
import { Button } from '@/design/Button'
import { QuietNote } from '@/design/QuietNote'
import { useNews } from '@/hooks/useNews'
import { useSettings } from '@/stores/settings'
import { NewsRow } from './NewsRow'

/**
 * The five states of one topic: switched off, reading, refused, empty, and the rows.
 *
 * Its own file so `News` stays a heading and a row of chips — five branches nested as one
 * expression is where a band stops being readable.
 */
export function NewsBody({ topic, reading }: { topic: NewsTopic; reading: boolean }) {
  const { t } = useTranslation()
  const setValue = useSettings(state => state.setValue)
  const news = useNews(topic, reading)

  if (!reading) {
    return (
      <div className="flex flex-col items-start gap-2">
        <QuietNote>{t('home.news.off')}</QuietNote>
        <Button onClick={() => void setValue('home.news', true)}>{t('home.news.turnOn')}</Button>
      </div>
    )
  }

  if (news.isPending) return <QuietNote>{t('home.news.reading')}</QuietNote>

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
