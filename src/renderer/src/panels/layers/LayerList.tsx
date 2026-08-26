import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tree } from '@/design/Tree'
import { allLayers, canRemoveLayer, isGroup } from '@/engines/canvas/canvasState'
import { moveLayer, setLayerVisible } from '@/engines/canvas/commands'
import { canvasOf, collapseLayerIn, selectLayerIn, useCanvases } from '@/stores/canvases'
import { VisibilityToggle } from '@/panels/shared/VisibilityToggle'
import { LayerRow } from './LayerRow'
import { openLayerMenu } from './layerMenu'
import { layerNodes, levelIndexOf, stackIndex } from './layerNodes'

/**
 * The stack of the document in front, listed through the same `Tree` as the scene outliner and
 * the file browser: virtualization, indentation, roving focus, the selection skin and the drag
 * are written once. A stack that drew its own rows was the one list in the studio a keyboard
 * could not reach, and the one nothing could reorder.
 *
 * No empty state: `removeLayer` refuses the last layer and `deserializeCanvas` rejects an empty
 * stack, so a canvas with nothing in it is not a state the user can reach.
 */
export function LayerList({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))
  // Which row is being renamed, held here rather than per row: the menu that opens a rename
  // lives on the tree, and there is only ever one name being typed at a time.
  const [renaming, setRenaming] = useState<string | null>(null)

  // Top of the list first, groups nesting — see `layerNodes`.
  const nodes = useMemo(() => layerNodes(canvas.layers), [canvas.layers])

  // Folding lives on the layer, so the set is rebuilt from the stack rather than held beside it:
  // two records of the same thing drift the first time a group comes back through undo.
  const expandedIds = useMemo(
    () =>
      new Set(
        allLayers(canvas.layers)
          .filter(layer => isGroup(layer) && !layer.collapsed)
          .map(layer => layer.id),
      ),
    [canvas.layers],
  )

  // Resolved once for the list: a row is remounted while scrolling, and translating inside one
  // would run i18next per row and per frame.
  const labels = useMemo(
    () => ({
      visible: t('layers.visible'),
      show: t('layers.showHint'),
      hide: t('layers.hideHint'),
      locks: t('layers.locks'),
      locksHint: t('layers.locksHint'),
      rename: t('layers.rename'),
      remove: t('layers.remove'),
      removeHint: t('layers.removeHint'),
    }),
    [t],
  )

  // The list counts from the top and the stack from the bottom — `stackIndex` is where the two
  // meet, and the only place that reversal is written.
  const move = (id: string, parentId: string | null, index: number): void => {
    const at = stackIndex(canvas, id, parentId, index)
    // A layer dropped back where it already sits would rebuild the stack into the same stack,
    // and leave an entry in the history that ⌘Z appears not to undo. `Tree` refuses this for an
    // insertion; a drop ONTO the group already holding it at the top reaches here too.
    if (levelIndexOf(canvas, id, parentId) === at) return

    useCanvases.getState().runCommand(documentId, moveLayer(id, parentId, at))
    // Opened, or a layer dropped into a folded group vanishes from the panel while the inspector
    // still describes it, and nothing on screen says where it went.
    if (parentId !== null) collapseLayerIn(documentId, parentId, false)
  }

  return (
    <Tree
      nodes={nodes}
      label={t('panels.layers')}
      // One at a time: a stack arms the layer that is painted on, and there is only ever one of
      // those.
      selectedIds={canvas.activeLayerId ? [canvas.activeLayerId] : []}
      expandedIds={expandedIds}
      expandable={node => isGroup(node.layer)}
      onToggle={id => collapseLayerIn(documentId, id, expandedIds.has(id))}
      onSelect={ids => {
        const id = ids.at(-1)
        if (!id) return
        // Arming is the whole of it: the inspector follows `activeLayerId` — see `InspectorFace`
        // — so posting a second copy to the global selection only wiped whatever else held it.
        selectLayerIn(documentId, id)
      }}
      // Only a group holds layers. Dropping onto one puts the layer at the top of it, which is
      // the first row the list draws inside it — where the eye was aiming.
      droppable={node => isGroup(node.layer)}
      // One row at a time: `dragMultiple` is off here, so the batch is always the row itself.
      // A stack arms ONE layer — there is no selection of several to carry.
      onDrop={(ids, parentId) => ids.forEach(id => move(id, parentId, 0))}
      onInsert={(ids, parentId, index) => ids.forEach(id => move(id, parentId, index))}
      // Through the tree rather than from the row: it is what holds the `preventDefault` a
      // right-click needs — without it the system raises its clipboard menu over ours — and the
      // guard that leaves a right-click inside the rename field to that menu alone.
      onContextMenu={node =>
        openLayerMenu({
          layer: node.layer,
          canRemove: canRemoveLayer(canvas.layers, node.layer),
          t,
          onRename: () => setRenaming(node.id),
          run: command => useCanvases.getState().runCommand(documentId, command),
        })
      }
      // Pinned to the RIGHT edge, outside the indentation: the eyes read as one straight column
      // whatever the depth or the length of a name, and the left of the panel is left to the
      // shape of the stack — the chevron, the indent, the name. Pinned on the left it pushed all
      // three across by its own width, which is what the panel had too much of.
      renderTrailing={row => (
        <VisibilityToggle
          visible={row.node.layer.visible}
          label={labels.visible}
          description={row.node.layer.visible ? labels.hide : labels.show}
          onToggle={() =>
            useCanvases
              .getState()
              .runCommand(documentId, setLayerVisible(row.node.layer.id, !row.node.layer.visible))
          }
        />
      )}
      renderRow={row => (
        <LayerRow
          documentId={documentId}
          layer={row.node.layer}
          labels={labels}
          canRemove={canRemoveLayer(canvas.layers, row.node.layer)}
          renaming={renaming === row.node.id}
          onRename={() => setRenaming(row.node.id)}
          onRenamed={() => setRenaming(null)}
        />
      )}
    />
  )
}
