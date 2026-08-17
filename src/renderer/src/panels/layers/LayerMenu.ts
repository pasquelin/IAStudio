import {
  mdiContentCopy,
  mdiFolderPlusOutline,
  mdiFolderRemoveOutline,
  mdiRenameOutline,
  mdiTrashCanOutline,
} from '@mdi/js'
import type { TFunction } from 'i18next'
import { isGroup, type CanvasState, type Layer } from '@/engines/canvas/canvasState'
import { duplicateLayer, groupLayers, removeLayer, ungroupLayer } from '@/engines/canvas/commands'
import type { Command } from '@/engines/core/history'
import { showContextMenu } from '@/helpers/contextMenu'
import { newId } from '@/helpers/ids'

export type LayerMenuProps = {
  layer: Layer
  /**
   * False on the last paintable layer of the stack. The command does not refuse it —
   * `deserializeCanvas` is what rejects an empty stack — so the refusal has to be here, as it
   * already is on the panel's own delete button.
   */
  canRemove: boolean
  /** The window's translator, as every menu of this studio takes it — see `openEntryMenu`. */
  t: TFunction
  onRename: () => void
  run: (command: Command<CanvasState>) => void
}

/**
 * What can be done with one layer of the stack.
 *
 * The rows name the layer the pointer is over, not the armed one — the right-click arms it
 * first, which is what keeps every sentence in the bundle true of both this menu and the
 * panel's title bar.
 *
 * Greyed rather than dropped, the rule this studio's menus already follow: a menu that changes
 * length depending on what is selected is a menu one cannot learn. `mergeDown` and `flatten`
 * are deliberately absent — they left the title bar for emptying the document from a button
 * nobody expected to, and bringing them back is a decision, not an oversight.
 */
export function openLayerMenu({ layer, canRemove, t, onRename, run }: LayerMenuProps): void {
  void showContextMenu([
    {
      label: t('layers.rename'),
      icon: mdiRenameOutline,
      tooltip: t('layers.renameHint'),
      onSelect: onRename,
    },
    {
      label: t('layers.duplicate'),
      icon: mdiContentCopy,
      tooltip: t('layers.duplicateHint'),
      onSelect: () =>
        run(duplicateLayer(layer.id, newId(), t('layers.copyName', { name: layer.name }), newId)),
    },
    {
      label: t('layers.group'),
      icon: mdiFolderPlusOutline,
      tooltip: t('layers.groupHint'),
      onSelect: () => run(groupLayers([layer.id], newId(), t('layers.groupName'))),
    },
    {
      label: t('layers.ungroup'),
      icon: mdiFolderRemoveOutline,
      tooltip: t('layers.ungroupHint'),
      disabled: !isGroup(layer),
      onSelect: () => run(ungroupLayer(layer.id)),
    },
    {
      label: t('layers.remove'),
      icon: mdiTrashCanOutline,
      tooltip: t('layers.removeHint'),
      disabled: !canRemove,
      onSelect: () => run(removeLayer(layer.id)),
    },
  ])
}
