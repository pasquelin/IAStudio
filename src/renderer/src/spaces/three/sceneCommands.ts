import type { CommandId } from '@shared/domain/command'
import {
  addNodes,
  copiesOf,
  groupNodes,
  removeNodes,
  rootedIn,
  setNodeVisible,
} from '@/engines/scene/commands'
import { nodeById, selectedNodes } from '@/engines/scene/sceneState'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { useSceneClipboard } from '@/stores/sceneClipboard'
import { sceneOf, useScenes } from '@/stores/scenes'

/**
 * The commands that act on what a scene has selected, and on nothing else — no mode, no view
 * setting, nothing a viewport holds in React state.
 *
 * Apart from the space's own dispatch because they now have three doors rather than two: the
 * toolbar, the keyboard and the native Édition menu all arrive as a `CommandId`, and so does the
 * context menu of a node. Written twice, a duplicate that stops offsetting its copies or a delete
 * that stops taking a subtree would be fixed on one door and left broken on the other.
 *
 * Answers whether the command was one of these, so the caller can go on to the ones only it can
 * serve. The viewport is reached through the registry rather than through a ref: a panel that is
 * not the viewport raises this menu too.
 */
/**
 * Flips the eye of one node, read at the moment it is asked for.
 *
 * Its own function because it is the only gesture of the node menu that is not a `CommandId`, and
 * because the state has to be FRESH: a native menu stands open for as long as the hand takes to
 * choose, and a `visible` captured when it was built would write back the value already in place
 * — an entry in the history that changes nothing, and a redo stack emptied for it.
 */
export function toggleNodeVisible(documentId: string, nodeId: string): void {
  const store = useScenes.getState()
  const node = nodeById(sceneOf(store, documentId), nodeId)
  if (node) store.runCommand(documentId, setNodeVisible(node.id, !node.visible))
}

export function runSceneCommand(documentId: string, command: CommandId): boolean {
  const store = useScenes.getState()
  const { nodes, selectedIds } = sceneOf(store, documentId)
  const picked = selectedNodes(nodes, selectedIds)

  switch (command) {
    case 'scene.frame':
      sceneEngineOf(documentId)?.frameSelection()
      return true

    case 'scene.delete':
      if (selectedIds.length > 0) store.runCommand(documentId, removeNodes(nodes, selectedIds))
      return true

    case 'scene.duplicate':
      if (picked.length > 0) store.runCommand(documentId, addNodes(copiesOf(nodes, picked)))
      return true

    case 'scene.copy':
      if (picked.length > 0) useSceneClipboard.getState().copy(copiesOf(nodes, picked))
      return true

    case 'scene.cut':
      if (picked.length === 0) return true
      useSceneClipboard.getState().copy(copiesOf(nodes, picked))
      store.runCommand(documentId, removeNodes(nodes, selectedIds))
      return true

    case 'scene.paste': {
      // Copied again on the way out: pasting twice must not put the same ids in twice.
      const held = useSceneClipboard.getState().nodes
      if (held.length === 0) return true
      store.runCommand(documentId, addNodes(rootedIn(copiesOf(held, held), nodes)))
      return true
    }

    case 'scene.group':
      if (picked.length > 0) store.runCommand(documentId, groupNodes(picked))
      return true

    default:
      return false
  }
}
