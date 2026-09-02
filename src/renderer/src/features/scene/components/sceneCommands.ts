import type { CommandId } from '@shared/domain/command'
import type { CsgOperation } from '@shared/domain/csg'
import { canInvertCarve, canNegate, canSeparate } from '@/engines/csg/carve'
import {
  addNodes,
  carveNodes,
  copiesOf,
  groupNodes,
  invertCarve,
  negateNodes,
  separateNode,
  removeNodes,
  rootedIn,
  setGeometry,
  setNodeVisible,
  setPath,
} from '@/engines/scene/commands'
import { railOf } from '@/engines/scene/nodeRail'
import { withoutPoint } from '@/engines/scene/cameraPath'
import {
  putOnAnimationSheet,
  removeCameraShot,
  takeOffAnimationSheet,
} from '@/engines/scene/animationCommands'
import { nodeById, rootsOf, selectedNodes, type SceneNode } from '@/engines/scene/sceneState'
import { newId } from '@/helpers/ids'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { useSceneClipboard } from '@/stores/sceneClipboard'
import type { CommandAnswer } from '@/services/commandBus'
import { runHistoryCommand } from '@/services/historyCommand'
import { sceneOf, sceneStore, useScenes } from '@/stores/scenes'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'

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

/**
 * The picked control point of a rail, taken away. Answers whether there was one, so a caller can
 * go on to what it would otherwise have deleted.
 *
 * Only while its rail is still the SELECTION, and that is what stops Delete from being hijacked:
 * a point is picked by a click in the viewport and let go of by another one, where the tree
 * selects through `selectIn`, which knows nothing of this. A point left over from a rail worked
 * on earlier would eat the Delete meant for the object just picked in the tree — and on a rail
 * already down to its last two points, it would swallow every Delete and do nothing at all.
 *
 * Two points is the floor `withoutPoint` holds — one point is not a line — and that refusal still
 * counts as handled: falling through would delete the rail the hand is working on.
 */
export function removePickedPathPoint(documentId: string): boolean {
  const picked = sceneViewOf(useSceneViews.getState(), documentId).pickedPathPoint
  if (!picked) return false

  const store = useScenes.getState()
  const scene = sceneOf(store, documentId)
  if (!scene.selectedIds.includes(picked.nodeId)) return false

  const node = nodeById(scene, picked.nodeId)
  const rail = railOf(node ?? undefined)
  if (!node || !rail) return false

  const path = withoutPoint(rail, picked.index)
  if (path === rail) return true

  // A band holds its rail inside its shape — see `railOf`: the edit lands on the geometry.
  if (node.type === 'path') store.runCommand(documentId, setPath(picked.nodeId, path))
  else if (node.type === 'mesh' && node.geometry.kind === 'ribbon') {
    store.runCommand(documentId, setGeometry(picked.nodeId, { ...node.geometry, path }))
  }
  useSceneViews.getState().setPickedPathPoint(documentId, null)
  return true
}

/**
 * The shot picked in the band, taken away. Answers whether there was one, the way a picked
 * control point does — and for the same reason, one payment later: Delete is an accelerator of
 * the native Édition menu, so it never reaches the band's own `onKeyDown`. Clicking a shot while
 * a camera stood selected deleted THE CAMERA, silently.
 */
export function removePickedShot(documentId: string): boolean {
  const picked = animationViewOf(useAnimationViews.getState(), documentId).selected
  if (picked.length === 0) return false

  const store = useScenes.getState()
  const shot = sceneOf(store, documentId).animation.shots.find(held => picked.includes(held.id))
  if (!shot) return false

  store.runCommand(documentId, removeCameraShot(shot.id))
  useAnimationViews.getState().setSelected(documentId, [])
  return true
}

/** Which cut each of the three buttons asks for. */
const OPERATION_OF: Record<'scene.carve' | 'scene.weld' | 'scene.intersect', CsgOperation> = {
  'scene.carve': 'subtract',
  'scene.weld': 'unite',
  'scene.intersect': 'intersect',
}

/**
 * What a command that CREATES answers — see `publishCommand`: the ids of what it made, roots only,
 * a subtree copied whole being one thing to the hand that asked.
 */
const madeOf = (copies: readonly SceneNode[]): CommandAnswer => ({
  nodeIds: rootsOf(copies).map(node => node.id),
})

export function runSceneCommand(documentId: string, command: CommandId): CommandAnswer {
  const store = useScenes.getState()
  const { nodes, selectedIds } = sceneOf(store, documentId)
  const picked = selectedNodes(nodes, selectedIds)

  switch (command) {
    case 'scene.frame':
      sceneEngineOf(documentId)?.frameSelection()
      return true

    // Who is on the band. The selection, never a list to pick from: a map of thousands of
    // objects is not one anybody scrolls through — one clicks the character and asks for this.
    case 'scene.addToSheet': {
      const command = putOnAnimationSheet(sceneOf(store, documentId), selectedIds)
      if (command) store.runCommand(documentId, command)
      return true
    }

    case 'scene.removeFromSheet': {
      const command = takeOffAnimationSheet(sceneOf(store, documentId), selectedIds)
      if (command) store.runCommand(documentId, command)
      return true
    }

    case 'scene.delete':
      // A picked control point is taken first: point and rail are one selection seen at two
      // depths, and Delete on a point that took the whole rail would be a rail nobody meant.
      if (removePickedPathPoint(documentId)) return true
      if (removePickedShot(documentId)) return true
      if (selectedIds.length > 0) store.runCommand(documentId, removeNodes(nodes, selectedIds))
      return true

    case 'scene.duplicate': {
      if (picked.length === 0) return true
      const copies = copiesOf(nodes, picked)
      store.runCommand(documentId, addNodes(copies))
      return madeOf(copies)
    }

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
      const pasted = rootedIn(copiesOf(held, held), nodes)
      store.runCommand(documentId, addNodes(pasted))
      return madeOf(pasted)
    }

    case 'scene.group': {
      if (picked.length === 0) return true
      const id = newId()
      store.runCommand(documentId, groupNodes(picked, id))
      return { nodeIds: [id] }
    }

    // Marks the selection as tools for the next fold — Roblox's Negate. Not a fold itself, so it
    // sits above the three and asks only that something carry a shape.
    case 'scene.negate':
      if (canNegate(picked)) store.runCommand(documentId, negateNodes(picked))
      return true

    // The three that fold a selection into one solid. A selection too thin is left alone rather
    // than refused out loud — `canCarve` is what leaves the button inert, so it never gets here.
    case 'scene.carve':
    case 'scene.weld':
    case 'scene.intersect': {
      const folded = carveNodes(picked, OPERATION_OF[command], nodes)
      if (folded) store.runCommand(documentId, folded)
      return true
    }

    // One click to repair a fold that ran backwards, where the alternative is an undo and a
    // rule to understand — see `invertCarve`.
    case 'scene.invertCarve': {
      const solid = picked[0]
      if (canInvertCarve(picked) && solid?.type === 'carved') {
        const flipped = invertCarve(solid, nodes)
        if (flipped) store.runCommand(documentId, flipped)
      }
      return true
    }

    case 'scene.separate': {
      const solid = picked[0]
      if (canSeparate(picked) && solid?.type === 'carved') {
        store.runCommand(documentId, separateNode(solid))
      }
      return true
    }

    /**
     * 🛑 `false` on an empty stack, which is what a caller needs: answered `ok` regardless, a
     * model sent nine undos in a row and took the whole decor apart (bench pass, 2026-08-26).
     */
    case 'scene.undo':
    case 'scene.redo':
      return runHistoryCommand(sceneStore, 'scene', documentId, command) ?? false

    default:
      return false
  }
}
