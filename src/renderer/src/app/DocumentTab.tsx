import { mdiClose } from '@mdi/js'
import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from 'dockview-react'
import { useCallback, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/design/ToolButton'
import { UiIcon } from '@/design/UiIcon'
import { workspaceById, workspaceLabelKey } from '@/helpers/workspaces'
import { useDocuments } from '@/stores/documents'
import { closeTab } from './close-tab'
import { DocumentTabMenu } from './DocumentTabMenu'
import { HINT_BOTTOM, TIP_BOTTOM } from '@/helpers/tooltip'

/**
 * A document's tab.
 *
 * Dockview's own close button removes the panel and nothing else — it cannot ask about unsaved
 * work, and it left the document's state, its history and its descriptor behind. So the default
 * tab is kept for its title, its drag behaviour and its look, its cross is hidden, and the one
 * drawn here goes through `closeTab` instead.
 *
 * The glyph in front is the document's SECTION, and it is what makes one tab strip readable for
 * six of them: a scene, an image and a texture now sit side by side, where the title alone says
 * nothing about which editor a tab opens. Same table as the rail and the document list — one
 * vocabulary, or two lists mean two different things by the same picture.
 */
export function DocumentTab(props: IDockviewPanelHeaderProps) {
  const { t } = useTranslation()
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null)
  const workspace = useDocuments(state => state.documents[props.api.id]?.workspace)

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
      {workspace && (
        // A hint and no `aria-label`: the tab's own title is its accessible name, and one set
        // here would replace it (WCAG 2.5.3). The sentence is what the glyph cannot spell.
        // No padding of its own: `.dv-tab` opens the row and the default tab's own padding
        // separates the glyph from the title.
        <span
          className="flex shrink-0 items-center"
          {...HINT_BOTTOM(t(workspaceLabelKey(workspace)))}
        >
          <UiIcon path={workspaceById(workspace).icon} size={14} className="text-muted" />
        </span>
      )}
      <DockviewDefaultTab {...props} hideClose onContextMenu={openMenu} />
      {/* Same footprint as the cross it replaces, so a tab does not change width for having
          its own close button. */}
      <ToolButton
        icon={mdiClose}
        label={t('documents.close')}
        tooltip={TIP_BOTTOM}
        variant="header"
        iconSize={12}
        className="mr-1 size-4 shrink-0 self-center"
        onClick={close}
      />

      {menuAt && <DocumentTabMenu documentId={props.api.id} at={menuAt} onClose={closeMenu} />}
    </>
  )
}
