import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Collection } from '@/design/Collection'
import { LIST_ROW_HEIGHT } from '@/design/styles'
import { canvasOf, selectLayerIn, useCanvases } from '@/stores/canvases'
import { LayerRow } from './LayerRow'

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

  /**
   * Top of the list first — what the eye sees on top is what the hand reaches first, and every
   * editor lays it out that way. The state stores it the other way round, bottom first, because
   * that is the order it is drawn in.
   */
  const stack = useMemo(() => [...canvas.layers].reverse(), [canvas.layers])

  // Resolved once for the list: a row is remounted while scrolling, and translating inside one
  // would run i18next per row and per frame.
  const labels = useMemo(
    () => ({
      visible: t('layers.visible'),
      show: t('layers.showHint'),
      hide: t('layers.hideHint'),
    }),
    [t],
  )

  return (
    <Collection
      items={stack}
      selectedId={canvas.activeLayerId}
      onSelect={layer => selectLayerIn(documentId, layer.id)}
      rowHeight={LIST_ROW_HEIGHT}
      renderRow={layer => <LayerRow documentId={documentId} layer={layer} labels={labels} />}
    />
  )
}
