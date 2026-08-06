import type { Command } from '../core/history'
import { objectById, type SceneObject, type SceneState, type Transform } from './scene-state'

/**
 * Scene edits, reimplemented in TypeScript from `mrdoob/three.js/editor/js/commands/` (MIT).
 * The structure is what was worth taking; the original is untyped JavaScript built on its own
 * `signals` bus.
 *
 * A command captures what it needs to revert **as it is applied**, not as it is built: what an
 * object looked like before is only known once the edit actually runs. Redo re-applies and
 * re-captures, so a command survives being replayed.
 */
export function addObject(object: SceneObject): Command<SceneState> {
  return {
    id: `add:${object.id}`,
    apply: state => ({ objects: [...state.objects, object], selectedId: object.id }),
    revert: state => ({
      objects: state.objects.filter(candidate => candidate.id !== object.id),
      selectedId: state.selectedId === object.id ? null : state.selectedId,
    }),
  }
}

export function removeObject(id: string): Command<SceneState> {
  let removed: SceneObject | null = null
  let index = -1

  return {
    id: `remove:${id}`,
    apply: state => {
      index = state.objects.findIndex(object => object.id === id)
      if (index < 0) return state
      removed = state.objects[index] ?? null
      return {
        objects: state.objects.filter(object => object.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }
    },
    revert: state => {
      if (!removed || index < 0) return state
      const objects = [...state.objects]
      // Back at its original index: re-appending would silently reorder the outliner.
      objects.splice(index, 0, removed)
      return { ...state, objects }
    },
  }
}

export function setTransform(id: string, next: Transform): Command<SceneState> {
  let previous: Transform | null = null

  return {
    id: `transform:${id}`,
    apply: state => {
      previous = objectById(state, id)?.transform ?? null
      return withTransform(state, id, next)
    },
    revert: state => (previous ? withTransform(state, id, previous) : state),
  }
}

function withTransform(state: SceneState, id: string, transform: Transform): SceneState {
  return {
    ...state,
    objects: state.objects.map(object => (object.id === id ? { ...object, transform } : object)),
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
export function selectObject(state: SceneState, id: string | null): SceneState {
  return { ...state, selectedId: id }
}
