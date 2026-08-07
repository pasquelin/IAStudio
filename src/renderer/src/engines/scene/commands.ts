import type { Command } from '../core/history'
import type { Transform } from '@shared/domain/scene'
import { nodeById, type SceneNode, type SceneState } from './scene-state'

/**
 * Scene edits, reimplemented in TypeScript from `mrdoob/three.js/editor/js/commands/` (MIT).
 * The structure is what was worth taking; the original is untyped JavaScript built on its own
 * `signals` bus.
 *
 * A command captures what it needs to revert **as it is applied**, not as it is built: what an
 * object looked like before is only known once the edit actually runs. Redo re-applies and
 * re-captures, so a command survives being replayed.
 */
export function addNode(node: SceneNode): Command<SceneState> {
  return {
    id: `add:${node.id}`,
    apply: state => ({ nodes: [...state.nodes, node], selectedId: node.id }),
    revert: state => ({
      nodes: state.nodes.filter(candidate => candidate.id !== node.id),
      selectedId: state.selectedId === node.id ? null : state.selectedId,
    }),
  }
}

export function removeNode(id: string): Command<SceneState> {
  let removed: SceneNode | null = null
  let index = -1

  return {
    id: `remove:${id}`,
    apply: state => {
      index = state.nodes.findIndex(node => node.id === id)
      if (index < 0) return state
      removed = state.nodes[index] ?? null
      return {
        nodes: state.nodes.filter(node => node.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }
    },
    revert: state => {
      if (!removed || index < 0) return state
      const nodes = [...state.nodes]
      // Back at its original index: re-appending would silently reorder the outliner.
      nodes.splice(index, 0, removed)
      return { ...state, nodes }
    },
  }
}

/**
 * One shape for every edit of a shared field: they all revert by putting the old values back.
 * The whole shared trio is captured rather than the single field touched — the history is a
 * linear stack, so nothing can change the node between `apply` and `revert`.
 */
function editNode(label: string, id: string, changes: NodePatch): Command<SceneState> {
  let previous: NodePatch | null = null

  return {
    id: `${label}:${id}`,
    apply: state => {
      const node = nodeById(state, id)
      if (!node) return state
      previous = { name: node.name, visible: node.visible, transform: node.transform }
      return patch(state, id, changes)
    },
    revert: state => (previous ? patch(state, id, previous) : state),
  }
}

export function setTransform(id: string, next: Transform): Command<SceneState> {
  return editNode('transform', id, { transform: next })
}

export function setNodeVisible(id: string, visible: boolean): Command<SceneState> {
  return editNode('visible', id, { visible })
}

export function renameNode(id: string, name: string): Command<SceneState> {
  return editNode('rename', id, { name })
}

/**
 * Only the fields every node shares: patching a discriminated field would let a light take a
 * geometry, which is exactly what the union exists to forbid.
 */
type NodePatch = Partial<Pick<SceneNode, 'name' | 'visible' | 'transform'>>

function patch(state: SceneState, id: string, changes: NodePatch): SceneState {
  return {
    ...state,
    nodes: state.nodes.map(node => (node.id === id ? { ...node, ...changes } : node)),
  }
}

/** One entry in the history for what the user did in one gesture. */
export function multi(id: string, commands: Command<SceneState>[]): Command<SceneState> {
  return {
    id,
    apply: state => commands.reduce((current, command) => command.apply(current), state),
    revert: state =>
      [...commands].reverse().reduce((current, command) => command.revert(current), state),
  }
}

/** Selection stays out of the history: nobody wants ⌘Z to give them back a selection. */
export function selectNode(state: SceneState, id: string | null): SceneState {
  return { ...state, selectedId: id }
}
