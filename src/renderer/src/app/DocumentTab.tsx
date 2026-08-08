import { mdiClose } from '@mdi/js'
import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from 'dockview-react'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { reportFailure } from '@/services/diagnostics'
import { closeDocument } from './document-io'
import { DocumentTabMenu } from './DocumentTabMenu'

/**
 * A document's tab.
 *
 * Dockview's own close button removes the panel and nothing else — it cannot ask about unsaved
 * work, and it left the document's state, its history and its descriptor behind. So the default
 * tab is kept for its title, its drag behaviour and its look, its cross is hidden, and the one
 * drawn here goes through `closeDocument` instead.
 */
export function DocumentTab(props: IDockviewPanelHeaderProps) {
  const { t } = useTranslation()
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const close = (event: MouseEvent): void => {
    // Dockview reads a click on the tab as "activate me"; this one is not that.
    event.stopPropagation()
    void closeDocument(props.api.id).catch(error =>
      reportFailure('document.close', props.api.id, error),
    )
  }

  const openMenu = (event: MouseEvent): void => {
    event.preventDefault()
    setMenuAt({ x: event.clientX, y: event.clientY })
  }

  return (
    <>
      <DockviewDefaultTab {...props} hideClose onContextMenu={openMenu} />
      <button
        type="button"
        aria-label={t('documents.close')}
        onClick={close}
        // Same footprint as the cross it replaces, so a tab does not change width for having
        // its own close button.
        className={cn(
          'text-muted hover:bg-elevated hover:text-text flex shrink-0 cursor-pointer',
          'mr-1 items-center justify-center rounded-(--radius-sc-sm) border-none bg-transparent',
          'size-4 self-center transition-colors',
        )}
      >
        <UiIcon path={mdiClose} size={12} />
      </button>

      {menuAt && (
        <DocumentTabMenu documentId={props.api.id} at={menuAt} onClose={() => setMenuAt(null)} />
      )}
    </>
  )
}
