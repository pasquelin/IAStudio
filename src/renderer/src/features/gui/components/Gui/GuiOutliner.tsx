import { mdiLockOutline } from '@mdi/js'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { UiElement } from '@shared/domain/ui'
import { flattenedWithParents } from '@game/ui/uiTree'
import { Row } from '@/components/Row'
import { Tree, type TreeNode } from '@/components/Tree'
import { UiIcon } from '@/components/UiIcon'
import { canHoldUi, reparentUiElements, setUiFlag } from '@/engines/gui/guiCommands'
import { uiTypeIcon } from '@/features/gui/components/Gui/guiTools'
import { VisibilityToggle } from '@/features/scene/components/VisibilityToggle'
import { guiOf, selectInGui, useGuis } from '@/stores/gui'

type GuiItem = TreeNode & { element: UiElement }

/**
 * The tree of one interface. The screen IS a row here, unlike the scene's synthetic root: a
 * document holds exactly one and everything hangs off it, so hiding it would leave the one
 * element that can be styled unreachable.
 */
export function GuiOutliner({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const root = useGuis(state => guiOf(state, documentId).document.root)
  const selectedIds = useGuis(state => guiOf(state, documentId).selectedIds)
  // Folding is session state: nobody wants ⌘Z to give them back a collapsed branch.
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set([root.id]))

  const items = useMemo<GuiItem[]>(
    () => flattenedWithParents(root).map(one => ({ id: one.element.id, ...one })),
    [root],
  )

  const move = (ids: readonly string[], parentId: string | null, index?: number): void => {
    if (parentId === null) return

    const allowed = ids.filter(id => canHoldUi(root, id, parentId))
    if (allowed.length === 0) return

    useGuis.getState().runCommand(documentId, reparentUiElements(allowed, parentId, index))
    // Opened, or what has just moved would vanish into a folded branch.
    setExpandedIds(current => new Set(current).add(parentId))
  }

  return (
    <Tree
      nodes={items}
      label={t('gui.tree')}
      selectedIds={selectedIds}
      expandedIds={expandedIds}
      // Taking hold of a row already picked takes the whole selection with it: six elements
      // filed into a panel in one gesture, which is the reason anyone selects six.
      dragMultiple
      // The screen has no siblings and nowhere else to hang from.
      draggable={item => item.id !== root.id}
      droppable={(item, dragged) => dragged.every(one => canHoldUi(root, one.id, item.id))}
      onDrop={(ids, parentId) => move(ids, parentId)}
      onInsert={(ids, parentId, index) => move(ids, parentId, index)}
      onSelect={(ids, mode) => selectInGui(documentId, ids, mode)}
      onToggle={id =>
        setExpandedIds(current => {
          const next = new Set(current)
          if (!next.delete(id)) next.add(id)
          return next
        })
      }
      // Pinned to the right edge, outside the indentation, so the eyes read as one column. The
      // cadenas is shown on the row itself rather than beside it: the tree holds ONE control's
      // width there, and locking is a toolbar action.
      renderTrailing={({ node: item }) => (
        <VisibilityToggle
          visible={item.element.visible}
          label={t('gui.visible')}
          onToggle={() =>
            useGuis
              .getState()
              .runCommand(documentId, setUiFlag(item.id, 'visible', !item.element.visible))
          }
        />
      )}
      renderRow={({ node: item }) => (
        <Row
          icon={uiTypeIcon(item.element.type)}
          title={item.element.name || t(`guiTools.types.${item.element.type}`)}
          muted={!item.element.visible}
          // A cadenas SHOWN rather than offered: the tree holds one control's width at its right
          // edge and the eye has it, so locking stays a toolbar action and this only says so.
          actions={item.element.locked ? <UiIcon path={mdiLockOutline} /> : undefined}
          hint={item.element.locked ? t('gui.locked') : undefined}
        />
      )}
    />
  )
}
