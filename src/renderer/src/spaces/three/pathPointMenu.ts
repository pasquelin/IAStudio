import { mdiTrashCanOutline } from '@mdi/js'
import type { TFunction } from 'i18next'
import { showContextMenu } from '@/helpers/contextMenu'

export type PathPointMenuProps = {
  /** The window's translator, as every menu of this studio takes it — see `openSceneNodeMenu`. */
  t: TFunction
  onRemove: () => void
}

/**
 * What can be done with one control point of a rail, right-clicked.
 *
 * Its own menu rather than a row added to the node's: a point is not a node, and a row that
 * appeared in the rail's menu only while a point happened to be picked would be a menu whose
 * length follows the selection — which is the one thing `openSceneNodeMenu` refuses.
 */
export function openPathPointMenu({ t, onRemove }: PathPointMenuProps): void {
  void showContextMenu([
    {
      label: t('scene.removePathPoint'),
      icon: mdiTrashCanOutline,
      tooltip: t('scene.removePathPointHint'),
      onSelect: onRemove,
    },
  ])
}
