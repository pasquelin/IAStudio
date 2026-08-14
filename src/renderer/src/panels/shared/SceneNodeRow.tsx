import { memo } from 'react'
import { Row } from '@/design/Row'
import type { Command } from '@/engines/core/history'
import { renameNode, setNodeVisible } from '@/engines/scene/commands'
import { iconOf } from '@/engines/scene/node-factory'
import type { SceneNode, SceneState } from '@/engines/scene/scene-state'
import { useScenes } from '@/stores/scenes'
import { InlineRename } from './InlineRename'
import { VisibilityToggle } from './VisibilityToggle'

export type SceneNodeRowProps = {
  documentId: string
  node: SceneNode
  /** Accessible name of the eye, which differs per panel. */
  visibleLabel: string
  /** Accessible name of the field the rename opens. Absent leaves the row unrenamable. */
  renameLabel?: string
  /** The name is being typed over. Held by the list: the menu that opens a rename sits there. */
  renaming?: boolean
  onRename?: () => void
  onRenamed?: () => void
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
  renameLabel,
  renaming,
  onRename,
  onRenamed,
}: SceneNodeRowProps) {
  const run = (command: Command<SceneState>): void =>
    useScenes.getState().runCommand(documentId, command)

  if (renaming && renameLabel) {
    return (
      <InlineRename
        value={node.name}
        label={renameLabel}
        onCommit={name => {
          onRenamed?.()
          if (name !== node.name) run(renameNode(node.id, name))
        }}
      />
    )
  }

  return (
    // On the name alone, as the layer stack does: a double click meant for the chevron or the
    // eye is not a rename.
    <div className="h-full min-w-0 flex-1" onDoubleClick={onRename}>
      <Row
        icon={iconOf(node)}
        title={node.name}
        muted={!node.visible}
        leading={
          <VisibilityToggle
            visible={node.visible}
            label={visibleLabel}
            onToggle={() => run(setNodeVisible(node.id, !node.visible))}
          />
        }
      />
    </div>
  )
})
