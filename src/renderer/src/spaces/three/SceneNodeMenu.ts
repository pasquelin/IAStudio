import {
  mdiContentCopy,
  mdiCropFree,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiFolderPlusOutline,
  mdiRenameOutline,
  mdiTrashCanOutline,
} from '@mdi/js'
import type { TFunction } from 'i18next'
import {
  addNodes,
  copiesOf,
  groupNodes,
  removeNodes,
  setNodeVisible,
} from '@/engines/scene/commands'
import type { Command } from '@/engines/core/history'
import { selectedNodes, type SceneState } from '@/engines/scene/scene-state'
import { showContextMenu, type ContextMenuRow } from '@/helpers/context-menu'
import { sceneEngineOf } from '@/stores/scene-engines'
import { sceneOf, selectIn, useScenes } from '@/stores/scenes'

export type SceneNodeMenuProps = {
  documentId: string
  /** The node under the pointer, by id: the viewport picks one out of a ray and holds nothing
   * else, and reading it here is what keeps both callers from passing a stale copy. */
  nodeId: string
  /** The window's translator, as every menu of this studio takes it — see `openLayerMenu`. */
  t: TFunction
  /**
   * Opens the name for typing. Absent in the viewport, which draws no name to type over: there
   * the node is renamed from the outliner or from the inspector's own field.
   */
  onRename?: () => void
}

/**
 * What can be done with one node of a scene, right-clicked — in the outliner or in the viewport.
 *
 * The rows act on the SELECTION, and the node under the pointer joins it first when it is not
 * already in it. Both halves matter: framing reads the engine's own selection rather than
 * anything passed here, so a menu that acted on the node alone would delete one thing and frame
 * another — and a right-click on a row of a selection of six must not shrink it to one.
 *
 * Greyed rather than dropped, the rule this studio's menus already follow: a menu that changes
 * length depending on what is selected is a menu one cannot learn. Copy, cut and paste are
 * deliberately absent — they are the four keys every editor shares and they already sit in the
 * native Édition menu, where a hand that lost them looks.
 */
export function openSceneNodeMenu({ documentId, nodeId, t, onRename }: SceneNodeMenuProps): void {
  // Armed before the rows are built. The outliner arms on pointer down, but the viewport's right
  // button flies the camera — so nothing has armed anything there by the time this runs.
  if (!sceneOf(useScenes.getState(), documentId).selectedIds.includes(nodeId)) {
    selectIn(documentId, [nodeId])
  }

  const { nodes, selectedIds } = sceneOf(useScenes.getState(), documentId)
  const node = nodes.find(candidate => candidate.id === nodeId)
  if (!node) return

  const picked = selectedNodes(nodes, selectedIds)
  const engine = sceneEngineOf(documentId)
  const run = (command: Command<SceneState>): void =>
    useScenes.getState().runCommand(documentId, command)

  const rows: ContextMenuRow[] = [
    {
      label: t('commands.sceneDuplicate.title'),
      icon: mdiContentCopy,
      tooltip: t('commands.sceneDuplicate.help'),
      onSelect: () => run(addNodes(copiesOf(nodes, picked))),
    },
    {
      label: t('commands.sceneGroup.title'),
      icon: mdiFolderPlusOutline,
      tooltip: t('commands.sceneGroup.help'),
      onSelect: () => run(groupNodes(picked)),
    },
    {
      label: t('commands.sceneFrame.title'),
      icon: mdiCropFree,
      tooltip: t('commands.sceneFrame.help'),
      // A scene left in a background tab has no viewport mounted, and therefore nothing to move.
      disabled: !engine,
      onSelect: () => engine?.frameSelection(),
    },
    {
      label: node.visible ? t('scene.hide') : t('scene.show'),
      icon: node.visible ? mdiEyeOffOutline : mdiEyeOutline,
      tooltip: node.visible ? t('scene.hideHint') : t('scene.showHint'),
      // The one row that stays on the node under the pointer: the eye of a row does the same,
      // and a selection of six half hidden has no single state to flip.
      onSelect: () => run(setNodeVisible(node.id, !node.visible)),
    },
    {
      label: t('commands.sceneDelete.title'),
      icon: mdiTrashCanOutline,
      tooltip: t('commands.sceneDelete.help'),
      onSelect: () => run(removeNodes(nodes, selectedIds)),
    },
  ]

  void showContextMenu(
    onRename
      ? [
          {
            label: t('scene.rename'),
            icon: mdiRenameOutline,
            tooltip: t('scene.renameHint'),
            onSelect: onRename,
          },
          ...rows,
        ]
      : rows,
  )
}
