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
import { commandDescriptor, type CommandId } from '@shared/domain/command'
import type { SceneNode } from '@/engines/scene/sceneState'
import { showContextMenu, type ContextMenuRow } from '@/helpers/context-menu'

export type SceneNodeMenuProps = {
  /** The node the pointer is over. Already selected by the caller — see below. */
  node: SceneNode
  /** False on a scene whose viewport is not mounted: there is then nothing to move. */
  canFrame: boolean
  /** The window's translator, as every menu of this studio takes it — see `openLayerMenu`. */
  t: TFunction
  /** Where the rows land: `runSceneCommand`, the same door the toolbar and the keyboard use. */
  run: (command: CommandId) => void
  /** The eye of a row, which is not a command of the space — see the row itself. */
  onToggleVisible: () => void
  /**
   * Opens the name for typing. Absent in the viewport, which draws no name to type over: there
   * the node is renamed from the outliner or from the inspector's own field. The one row that
   * varies, and it varies with the SURFACE rather than with the selection — the rule against a
   * menu of changing length is about the second, which no row here breaks.
   */
  onRename?: () => void
}

/**
 * What can be done with one node of a scene, right-clicked — in the outliner or in the viewport.
 *
 * Five of the six rows are `CommandId`s rather than commands: they are the very ones the toolbar,
 * the keyboard and the native Édition menu already run, and a second copy of "duplicate" would
 * drift from the first the day one of them learns to offset its copies.
 *
 * The rows act on the SELECTION, never on the node alone — framing reads the engine's own, so a
 * menu that deleted one thing and framed another would be unreadable. Selecting the node first is
 * therefore the caller's job, as it is for the asset shelf (`DraggableAsset`): the outliner arms
 * on pointer down, and the viewport has to do it by hand because its right button flies the
 * camera.
 *
 * Copy, cut and paste are deliberately absent — the four keys every editor shares already sit in
 * the native Édition menu, where a hand that lost them looks.
 */
export function openSceneNodeMenu({
  node,
  canFrame,
  t,
  run,
  onToggleVisible,
  onRename,
}: SceneNodeMenuProps): void {
  // Named by the registry rather than by keys written again here: the row then says exactly what
  // the toolbar's tooltip and the native menu's entry say, and a renamed command cannot leave one
  // of the three behind.
  const command = (id: CommandId, icon: string): ContextMenuRow => {
    const descriptor = commandDescriptor(id)
    return {
      label: descriptor ? t(descriptor.titleKey) : id,
      icon,
      tooltip: descriptor ? t(descriptor.helpKey) : id,
      onSelect: () => run(id),
    }
  }

  void showContextMenu([
    ...(onRename
      ? [
          {
            label: t('scene.rename'),
            icon: mdiRenameOutline,
            tooltip: t('scene.renameHint'),
            onSelect: onRename,
          },
        ]
      : []),
    command('scene.duplicate', mdiContentCopy),
    command('scene.group', mdiFolderPlusOutline),
    { ...command('scene.frame', mdiCropFree), disabled: !canFrame },
    {
      label: node.visible ? t('scene.hide') : t('scene.show'),
      icon: node.visible ? mdiEyeOffOutline : mdiEyeOutline,
      tooltip: node.visible ? t('scene.hideHint') : t('scene.showHint'),
      // The one row that stays on the node under the pointer: the eye of a row does the same, and
      // a selection of six half hidden has no single state to flip.
      onSelect: onToggleVisible,
    },
    command('scene.delete', mdiTrashCanOutline),
  ])
}
