import { mdiClose } from '@mdi/js'
import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from 'dockview-react'
import { useCallback, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { closeTab } from './close-tab'
import { DocumentTabMenu } from './DocumentTabMenu'

/**
 * A document's tab.
 *
 * Dockview's own close button removes the panel and nothing else — it cannot ask about unsaved
 * work, and it left the document's state, its history and its descriptor behind. So the default
 * tab is kept for its title, its drag behaviour and its look, its cross is hidden, and the one
 * drawn here goes through `closeTab` instead.
 */
export function DocumentTab(props: IDockviewPanelHeaderProps) {
  const { t } = useTranslation()
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)

  const close = (event: MouseEvent): void => {
    // Dockview reads a click on the tab as "activate me"; this one is not that.
    event.stopPropagation()
    closeTab(props.api.id)
  }

  const openMenu = (event: MouseEvent): void => {
    event.preventDefault()
    setMenuAt({ x: event.clientX, y: event.clientY })
  }

  // Stable, or the open menu re-subscribes its three global listeners every time the tab
  // re-renders — which it does on every title change and every modified bullet.
  const closeMenu = useCallback(() => setMenuAt(null), [])

  return (
    <>
      <DockviewDefaultTab {...props} hideClose onContextMenu={openMenu} />
      {/* Same footprint as the cross it replaces, so a tab does not change width for having
          its own close button. */}
      <ToolButton
        icon={mdiClose}
        label={t('documents.close')}
        variant="header"
        iconSize={12}
        className="mr-1 size-4 shrink-0 self-center"
        onClick={close}
      />

      {menuAt && <DocumentTabMenu documentId={props.api.id} at={menuAt} onClose={closeMenu} />}
    </>
  )
}
