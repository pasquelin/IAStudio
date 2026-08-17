import { mdiRefresh } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'

/**
 * The panel's title row.
 *
 * One button for now, and it earns its place: the studio refreshes on its own when the project
 * changes, when its folder changes on disk and when the window comes back to the front — but a
 * user who has just done something in a terminal wants to see it NOW, and waiting for the folder
 * watch to notice is exactly the moment a version panel feels broken.
 */
export function GitActions() {
  const { t } = useTranslation()
  const busy = useGit(state => state.busy)
  const refresh = useGit(state => state.refresh)

  return (
    <ToolButton
      icon={mdiRefresh}
      label={t('git.refresh')}
      description={t('git.refreshHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      disabled={busy}
      onClick={() => void refresh()}
    />
  )
}
