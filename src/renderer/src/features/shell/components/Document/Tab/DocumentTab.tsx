import { mdiClose } from '@mdi/js'
import { DockviewDefaultTab, type IDockviewPanelHeaderProps } from 'dockview-react'
import { useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ToolButton } from '@/components/ToolButton'
import { UiIcon } from '@/components/UiIcon'
import { InlineRename } from '@/components/InlineRename'
import { renameDocument } from '@/helpers/rename'
import { workspaceById, workspaceLabelKey } from '@/helpers/workspaces'
import { useDocuments } from '@/stores/documents'
import { closeTab } from './closeTab'
import { openDocumentTabMenu } from './documentTabMenu'
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
  const workspace = useDocuments(state => state.documents[props.api.id]?.workspace)
  const title = useDocuments(state => state.documents[props.api.id]?.title)
  const [renaming, setRenaming] = useState(false)

  const close = (event: MouseEvent): void => {
    // Dockview reads a click on the tab as "activate me"; this one is not that.
    event.stopPropagation()
    closeTab(props.api.id)
  }

  const openMenu = (event: MouseEvent): void => {
    event.preventDefault()
    openDocumentTabMenu({ documentId: props.api.id, t, onRename: () => setRenaming(true) })
  }

  const commitRename = (name: string): void => {
    setRenaming(false)
    if (title) renameDocument(props.api.id, title, name)
  }

  /**
   * The field takes the whole tab while it is open — the drag, the close button and the space
   * glyph all step aside. Dockview's own tab is what carries the drag, and leaving it mounted
   * under a field would have a rename begin a drag on the first pointer move.
   */
  if (renaming && title)
    return (
      <span className="flex-1 px-1">
        <InlineRename
          value={title}
          label={t('documents.renameLabel')}
          onCommit={commitRename}
          gauge="inline"
        />
      </span>
    )

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
      {/* Double-click renames, as it does in the layer stack, the outliner and the track
          headers — the gesture a title one can edit is expected to answer. */}
      <DockviewDefaultTab
        {...props}
        hideClose
        onContextMenu={openMenu}
        onDoubleClick={() => setRenaming(true)}
      />
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
    </>
  )
}
