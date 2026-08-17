import { mdiRefresh } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
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
  const busy = useGit(state => state.busy)
  const readHistory = useGit(state => state.readHistory)

  return (
    <ToolButton
      icon={mdiRefresh}
      label={t('git.refresh')}
      description={t('git.historyRefreshHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      disabled={busy}
      onClick={() => void readHistory(false)}
    />
  )
}
