import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/design/EmptyState'
import { useProject } from '@/stores/project'

export type NoProjectProps = {
  icon: string
  /** Why THIS panel needs one. The two ways out are the same everywhere; the reason is not. */
  message: string
}

/**
 * What a panel shows when it needs a project and there is none, and the two ways to get one.
 *
 * Written once: a panel that only says what is missing leaves the reader hunting for the home,
 * and a second copy of this is a second chance to forget one of the two gestures. Same reason
 * `MissingCredentials` exists beside it.
 *
 * **It never draws before the main process has answered.** `project` starts `null` and means
 * "not asked yet" until `known` turns — and the studio reopens the last project on launch, so a
 * panel that took the initial `null` for an answer offers to create a project to someone who
 * already has one, for as long as the reopening takes.
 */
export function NoProject({ icon, message }: NoProjectProps) {
  const { t } = useTranslation()
  const known = useProject(state => state.known)

  return (
    <EmptyState
      icon={icon}
      message={known ? message : t('collection.loading')}
      {...(known
        ? {
            action: {
              label: t('project.open'),
              hint: t('project.openHint'),
              onClick: () => void useProject.getState().openPicked(),
            },
            secondary: {
              label: t('project.create'),
              hint: t('project.createHint'),
              onClick: () => void useProject.getState().createPicked(),
            },
          }
        : {})}
    />
  )
}
