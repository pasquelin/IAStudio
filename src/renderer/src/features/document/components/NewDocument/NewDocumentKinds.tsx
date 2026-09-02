import { mdiFolderPlusOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { Creatable } from '@shared/domain/creatable'
import { roleForKind, type DocumentKind } from '@shared/domain/document'
import { UiIcon } from '@/components/UiIcon'
import { WindowNav } from '@/components/WindowNav/WindowNav'
import { WindowNavItem } from '@/components/WindowNav/WindowNavItem'
import { WINDOW_ACTION } from '@/components/windowStyles'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { roleIcon, roleInk } from '@/helpers/workspaces'

export type NewDocumentKindsProps = {
  /** Already ordered by the surface the window was opened from — nearest work first. */
  creatables: readonly Creatable[]
  selected: DocumentKind | null
  /** Every kind is dimmed without one: a document is a file, and a file needs a folder. */
  hasProject: boolean
  onSelect: (kind: DocumentKind) => void
  onNewProject: () => void
}

/**
 * What the studio can make, as the column of the window that makes it. The project row is pinned
 * over the scrolling list, the shape the settings window uses for its search field.
 *
 * Inked by SECTION, the hue the Explorer already gives that file: one colour code, not two.
 */
export function NewDocumentKinds({
  creatables,
  selected,
  hasProject,
  onSelect,
  onNewProject,
}: NewDocumentKindsProps) {
  const { t } = useTranslation()

  return (
    <>
      <button
        type="button"
        className={cn(WINDOW_ACTION, 'justify-start')}
        {...HINT_RIGHT(t('project.createHint'))}
        onClick={onNewProject}
      >
        <UiIcon path={mdiFolderPlusOutline} size={14} className="shrink-0" />
        {t('project.create')}
      </button>

      <WindowNav>
        {creatables.map(({ kind }) => {
          const role = roleForKind(kind)
          return (
            <WindowNavItem
              key={kind}
              active={kind === selected}
              disabled={!hasProject}
              hint={t(`documents.newByKind.${kind}`)}
              className="gap-2 px-2"
              onSelect={() => onSelect(kind)}
            >
              <UiIcon path={roleIcon(role)} size={14} className={cn('shrink-0', roleInk(role))} />
              {t(`documents.kinds.${kind}`)}
            </WindowNavItem>
          )
        })}
      </WindowNav>
    </>
  )
}
