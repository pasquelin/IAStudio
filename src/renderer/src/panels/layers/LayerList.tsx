import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Collection } from '@/design/Collection'
import { LIST_ROW_HEIGHT } from '@/design/styles'
import { canvasOf, selectLayerIn, useCanvases } from '@/stores/canvases'
import { useSelection } from '@/stores/selection'
import { LayerRow } from './LayerRow'
import { layerRows } from './layer-rows'

/**
 * The stack of the document in front, listed through the same `Collection` as the mesh and light
 * panels: virtualization, roving focus and the selection skin are written once, and a stack that
 * drew its own rows was the one list in the studio a keyboard could not reach.
 *
 * No empty state: `removeLayer` refuses the last layer and `deserializeCanvas` rejects an empty
 * stack, so a canvas with nothing in it is not a state the user can reach.
 */
export function LayerList({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const canvas = useCanvases(state => canvasOf(state, documentId))

  // Top of the list first, groups nesting — see `layerRows`.
  const stack = useMemo(() => layerRows(canvas.layers), [canvas.layers])

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
      collapse: t('layers.collapse'),
      expand: t('layers.expand'),
    }),
    [t],
  )

  return (
    <Collection
      label={t('panels.layers')}
      items={stack}
      // One at a time: a stack arms the layer that is painted on, and there is only ever one of
      // those. The plural is the collection's, which the scene outliner needs.
      selectedIds={canvas.activeLayerId ? [canvas.activeLayerId] : []}
      onSelect={row => {
        selectLayerIn(documentId, row.layer.id)
        // The stack arms a layer to paint on; the inspector reads what was touched last. Both,
        // or picking a row would describe whatever was selected before it.
        useSelection.getState().selectLayer(documentId, row.layer.id)
      }}
      rowHeight={LIST_ROW_HEIGHT}
      renderRow={row => (
        <LayerRow documentId={documentId} layer={row.layer} depth={row.depth} labels={labels} />
      )}
    />
  )
}
