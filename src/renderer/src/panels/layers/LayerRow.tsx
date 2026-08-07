import { memo } from 'react'
import { Row } from '@/design/Row'
import type { Layer } from '@/engines/canvas/canvas-state'
import { setLayerVisible } from '@/engines/canvas/commands'
import { VisibilityToggle } from '@/panels/shared/VisibilityToggle'
import { useCanvases } from '@/stores/canvases'

/** Resolved by the list rather than per row — see `LayerList`. */
export type LayerRowLabels = { visible: string; show: string; hide: string }

export type LayerRowProps = {
  documentId: string
  layer: Layer
  labels: LayerRowLabels
}

/**
 * Memoized, as `SceneNodeRow` is: layer identity survives every command that does not touch it,
 * so hiding one re-renders one row instead of the whole stack.
 */
export const LayerRow = memo(function LayerRow({ documentId, layer, labels }: LayerRowProps) {
  return (
    <Row
      title={layer.name}
      muted={!layer.visible}
      leading={
        <VisibilityToggle
          visible={layer.visible}
          label={labels.visible}
          description={layer.visible ? labels.hide : labels.show}
          onToggle={() =>
            useCanvases.getState().runCommand(documentId, setLayerVisible(layer.id, !layer.visible))
          }
        />
      }
    />
  )
})
