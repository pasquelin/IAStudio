import { useTranslation } from 'react-i18next'
import type { NewsItem } from '@shared/domain/news'
import { rowSkin, ROW_INK, ROW_QUIET } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { formatDecimal } from '@/helpers/format'
import { timeAgo } from '@/helpers/relativeTime'
import { HINT_TOP } from '@/helpers/tooltip'

/**
 * One row of the news band, and it is a LINK rather than a button: these pages belong to
 * somebody else, and the studio opens them in the browser — `setWindowOpenHandler` hands an
 * HTTPS URL to the system and denies the window, so nothing navigates here.
 */
export function NewsRow({ item }: { item: NewsItem }) {
  const { t, i18n } = useTranslation()

  const said = [
    item.downloads === null
      ? null
      : t('home.news.downloads', {
          count: item.downloads,
          value: formatDecimal(item.downloads, i18n.language, { digits: 0 }),
        }),
    item.publishedAt === null ? null : timeAgo(item.publishedAt, i18n.language),
  ].filter(part => part !== null)

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      {...HINT_TOP(t('home.news.openHint'))}
      className={cn(
        rowSkin(false),
        'flex items-center gap-3 px-2 py-1.5 no-underline',
        // The row is the whole target, and a link that only takes its own text width leaves a
        // strip of the row inert — which reads as a list that answers in some places and not
        // others.
        'w-full',
      )}
    >
      <span className={cn(ROW_INK, 'min-w-0 flex-1 truncate text-xs')}>{item.title}</span>
      {said.length > 0 && (
        <span className={cn(ROW_QUIET, 'text-tiny shrink-0')}>{said.join(' · ')}</span>
      )}
    </a>
  )
}
