import { mdiFolderOpenOutline, mdiFolderOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { projectName, projectsByCreation, type RecentProject } from '@shared/domain/project'
import { UiIcon } from '@/components/UiIcon'
import {
  WINDOW_ACTION,
  WINDOW_ACTION_SECONDARY,
  WINDOW_CAPTION,
  WINDOW_GROUP_LABEL,
  WINDOW_ROW_BUTTON,
} from '@/components/windowStyles'
import { cn } from '@/helpers/cn'
import { HINT_TOP } from '@/helpers/tooltip'

export type NewDocumentNoProjectProps = {
  recent: readonly RecentProject[]
  onNewProject: () => void
  onOpenProject: () => void
  onOpenRecent: (path: string) => void
}

/**
 * The pane with no project open: why nothing can be made yet, and the shortest ways out of it.
 *
 * The shelf is offered here rather than behind a second gesture, which is the whole point of the
 * screen — a document needs a project, and asking someone to close this window, find the title
 * bar and come back is the click this lot exists to remove.
 *
 * None of the three acts here: they are ANSWERED to the studio, which owns leaving a project and
 * everything that follows it. See `NewDocumentAnswer`.
 */
export function NewDocumentNoProject({
  recent,
  onNewProject,
  onOpenProject,
  onOpenRecent,
}: NewDocumentNoProjectProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-base font-semibold">{t('project.none')}</h2>
        <p className={cn(WINDOW_CAPTION, 'm-0')}>{t('documents.noProjectBody')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={WINDOW_ACTION}
          {...HINT_TOP(t('project.createHint'))}
          onClick={onNewProject}
        >
          {t('project.create')}
        </button>
        <button
          type="button"
          className={WINDOW_ACTION_SECONDARY}
          {...HINT_TOP(t('project.openHint'))}
          onClick={onOpenProject}
        >
          <UiIcon path={mdiFolderOpenOutline} size={14} className="shrink-0" />
          {t('project.open')}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="flex flex-col">
          <span className={WINDOW_GROUP_LABEL}>{t('documents.recentProjects')}</span>
          {/* Ordered by creation, the same key the home's shelf and the title bar's menu read it
              by: one list must not be read in two orders. */}
          {projectsByCreation(recent).map(entry => (
            <button
              key={entry.path}
              type="button"
              className={cn(WINDOW_ROW_BUTTON, 'items-center px-2')}
              {...HINT_TOP(t('project.useHint'))}
              onClick={() => onOpenRecent(entry.path)}
            >
              <UiIcon path={mdiFolderOutline} size={14} className="shrink-0" />
              {projectName(entry.path)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
