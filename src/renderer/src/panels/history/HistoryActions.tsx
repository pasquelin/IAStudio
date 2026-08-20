import { useTranslation } from 'react-i18next'
import { GitRefreshButton } from '@/panels/shared/GitRefreshButton'
import { useGit } from '@/stores/git'

/**
 * The history's title row.
 *
 * Re-reads from the first page rather than adding to what is held: a refresh asked for by hand
 * is asked for because something happened OUTSIDE the studio, and appending under a log that has
 * moved would leave the two halves describing different repositories.
 */
export function HistoryActions() {
  const { t } = useTranslation()
  const readHistory = useGit(state => state.readHistory)

  return (
    <GitRefreshButton
      description={t('git.historyRefreshHint')}
      onClick={() => void readHistory(false)}
    />
  )
}
