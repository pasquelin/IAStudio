import { mdiChevronRight } from '@mdi/js'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { FOLDER_ROOT, nameOf } from '@shared/domain/folder'
import { UiIcon } from '@/design/UiIcon'
import { HINT_BOTTOM } from '@/helpers/tooltip'
import { folderTrail } from './folderTrail'

export type FolderCrumbsProps = {
  /** The folder being browsed. `FOLDER_ROOT` shows the project's own crumb, alone. */
  folder: string
  onPick: (folder: string) => void
}

/**
 * The way back up, for the grid: it is flat, so going down a level would shut a door behind you.
 * `HINT_BOTTOM` and not a factory — a crumb shows its own name, over which one would set an
 * `aria-label` (WCAG 2.5.3).
 */
export function FolderCrumbs({ folder, onPick }: FolderCrumbsProps) {
  const { t } = useTranslation()
  const trail = folderTrail(folder)

  return (
    <nav aria-label={t('explorer.crumbs')} className="flex min-w-0 items-center gap-2">
      {trail.map((crumb, index) => (
        <Fragment key={crumb}>
          {index > 0 && <UiIcon path={mdiChevronRight} size={12} className="text-muted shrink-0" />}

          {/* The folder shown is a label, not somewhere to go: a button that did nothing would
              still take a tab stop and announce a way out of where you already are. */}
          {index === trail.length - 1 ? (
            <span className="text-text text-mini truncate">
              {crumb === FOLDER_ROOT ? t('explorer.projectFolder') : nameOf(crumb)}
            </span>
          ) : (
            <button
              type="button"
              {...HINT_BOTTOM(t('explorer.crumbHint'))}
              onClick={() => onPick(crumb)}
              className="text-muted hover:text-text text-mini shrink-0 cursor-pointer truncate transition-colors"
            >
              {crumb === FOLDER_ROOT ? t('explorer.projectFolder') : nameOf(crumb)}
            </button>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
