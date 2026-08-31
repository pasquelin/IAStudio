import { mdiChevronRight } from '@mdi/js'
import { Fragment } from 'react'
import { FOLDER_ROOT, folderTrail, nameOf } from '@shared/domain/folder'
import { cn } from '@/helpers/cn'
import type { HintFactory } from '@/helpers/tooltip'
import { UiIcon } from './UiIcon'

export type FolderCrumbsProps = {
  /** The folder being browsed. `FOLDER_ROOT` shows the project's own crumb, alone. */
  folder: string
  onPick: (folder: string) => void
  /** Already translated: this draws what it is handed and looks nothing up. */
  labels: { nav: string; projectFolder: string; hint: string }
  /** From the host, which alone knows whether there is room below the crumbs or above them. */
  tip: HintFactory
  className?: string
}

/**
 * The way back up, for a flat listing: it shows one folder at a time, so walking down a level
 * would shut a door behind you.
 *
 * Not a factory: a crumb shows its own name (WCAG 2.5.3).
 */
export function FolderCrumbs({ folder, onPick, labels, tip, className }: FolderCrumbsProps) {
  const trail = folderTrail(folder)

  return (
    <nav
      aria-label={labels.nav}
      className={cn('flex min-w-0 items-center gap-2 px-2 py-1.5', className)}
    >
      {trail.map((crumb, index) => (
        <Fragment key={crumb}>
          {index > 0 && <UiIcon path={mdiChevronRight} size={12} className="text-muted shrink-0" />}

          {/* The folder shown is a label, not somewhere to go: a button that did nothing would
              still take a tab stop and announce a way out of where you already are. */}
          {index === trail.length - 1 ? (
            <span className="text-text text-mini truncate">
              {crumb === FOLDER_ROOT ? labels.projectFolder : nameOf(crumb)}
            </span>
          ) : (
            <button
              type="button"
              {...tip(labels.hint)}
              onClick={() => onPick(crumb)}
              className="text-muted hover:text-text text-mini shrink-0 cursor-pointer truncate transition-colors"
            >
              {crumb === FOLDER_ROOT ? labels.projectFolder : nameOf(crumb)}
            </button>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
