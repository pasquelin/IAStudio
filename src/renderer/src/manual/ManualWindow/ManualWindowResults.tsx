import { useTranslation } from 'react-i18next'
import { WindowNote } from '@/design/WindowNote'
import type { ManualChapter } from '@shared/domain/manual'
import { WINDOW_CAPTION, WINDOW_ROW_BUTTON } from '@/design/windowStyles'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT } from '@/helpers/tooltip'

/** The chapters the words appear in, as the settings window lists what it found. */
export function ManualWindowResults({
  found,
  onOpen,
}: {
  found: readonly ManualChapter[]
  onOpen: (slug: string) => void
}) {
  const { t } = useTranslation()

  if (found.length === 0) return <WindowNote>{t('manual.noResult')}</WindowNote>

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {found.map(entry => (
        <li key={entry.slug}>
          <button
            type="button"
            {...HINT_RIGHT(t('manual.searchResultHint'))}
            onClick={() => onOpen(entry.slug)}
            className={cn(WINDOW_ROW_BUTTON, 'items-baseline')}
          >
            <span className={WINDOW_CAPTION}>{entry.number}</span>
            <span className="text-xs font-medium">{entry.title}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
