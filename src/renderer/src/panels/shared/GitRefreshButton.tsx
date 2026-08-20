import { mdiRefresh } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

export type GitRefreshButtonProps = {
  /** What THIS one re-reads — the two panels read different halves. Already translated. */
  description: string
  onClick: () => void
}

/**
 * The one button in the title row of a panel that reads the repository — the working copy on one
 * side, the log on the other. Refused while a read is in flight, which is the reason it is one
 * button rather than two: a second read started under the first leaves the halves disagreeing.
 */
export function GitRefreshButton({ description, onClick }: GitRefreshButtonProps) {
  const { t } = useTranslation()
  const busy = useGit(state => state.busy)

  return (
    <ToolButton
      icon={mdiRefresh}
      label={t('git.refresh')}
      description={description}
      tooltip={TIP_BOTTOM}
      variant="header"
      disabled={busy}
      onClick={onClick}
    />
  )
}
