import { memo } from 'react'
import { Row } from '@/design/Row'
import { setNodeVisible } from '@/engines/scene/commands'
import { iconOf } from '@/engines/scene/node-factory'
import type { SceneNode } from '@/engines/scene/scene-state'
import { useScenes } from '@/stores/scenes'
import { VisibilityToggle } from './VisibilityToggle'

export type SceneNodeRowProps = {
  documentId: string
  node: SceneNode
  /** Accessible name of the eye, which differs per panel. */
  visibleLabel: string
}

/**
 * A scene node as a line, shared by the outliner and the two panels — the three places that
 * must not disagree about what a node looks like or how its eye behaves.
 *
 * Memoized: node identity survives every command that does not touch it, so a selection or an
 * edit elsewhere re-renders one row instead of the whole list.
 */
export const SceneNodeRow = memo(function SceneNodeRow({
  documentId,
  node,
  visibleLabel,
}: SceneNodeRowProps) {
  return (
    <Row
      icon={iconOf(node)}
      title={node.name}
      muted={!node.visible}
      leading={
        <VisibilityToggle
          visible={node.visible}
          label={visibleLabel}
          onToggle={() =>
            useScenes.getState().runCommand(documentId, setNodeVisible(node.id, !node.visible))
          }
        />
      }
    />
  )
})
