import { useTranslation } from 'react-i18next'
import { useGit } from '@/stores/git'
import { GitRefreshButton } from '@/features/git/components/Git/GitRefreshButton'

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
  const refresh = useGit(state => state.refresh)

  return <GitRefreshButton description={t('git.refreshHint')} onClick={() => void refresh()} />
}
