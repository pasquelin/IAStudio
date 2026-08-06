import { create } from 'zustand'
import { emptyHistory, redo, run, undo, type Command, type History } from '@/engines/core/history'
import { EMPTY_SCENE, type SceneState } from '@/engines/scene/scene-state'

type ScenesState = {
  scenes: Record<string, SceneState>
  histories: Record<string, History<SceneState>>
  runCommand: (documentId: string, command: Command<SceneState>) => void
  setScene: (documentId: string, state: SceneState) => void
  undoScene: (documentId: string) => void
  redoScene: (documentId: string) => void
  dropScene: (documentId: string) => void
}

type Readable = Pick<ScenesState, 'scenes' | 'histories'>

export function sceneOf(state: Readable, documentId: string): SceneState {
  return state.scenes[documentId] ?? EMPTY_SCENE
}

export function historyOf(state: Readable, documentId: string): History<SceneState> {
  return state.histories[documentId] ?? emptyHistory<SceneState>()
}

/**
 * One scene and **one history per document**, as spec §8.3 requires: ⌘Z undoes the last action
 * of the active document, not of whatever was edited last anywhere.
 *
 * In memory, like the documents themselves.
 */
export const useScenes = create<ScenesState>()((set, get) => {
  /**
   * `run`, `undo` and `redo` share one signature, so the three actions share one body: read the
   * document's pair, step it, write it back.
   */
  const step = (
    documentId: string,
    apply: (scene: SceneState, history: History<SceneState>) => [SceneState, History<SceneState>],
  ): void => {
    const [scene, history] = apply(sceneOf(get(), documentId), historyOf(get(), documentId))
    set(state => ({
      scenes: { ...state.scenes, [documentId]: scene },
      histories: { ...state.histories, [documentId]: history },
    }))
  }

  return {
    scenes: {},
    histories: {},

    runCommand: (documentId, command) =>
      step(documentId, (scene, history) => run(scene, history, command)),

    // Selection is not a command, so it lands here rather than in the history.
    setScene: (documentId, scene) =>
      set(state => ({ scenes: { ...state.scenes, [documentId]: scene } })),

    undoScene: documentId => step(documentId, undo),

    redoScene: documentId => step(documentId, redo),

    dropScene: documentId =>
      set(state => {
        const scenes = { ...state.scenes }
        const histories = { ...state.histories }
        delete scenes[documentId]
        delete histories[documentId]
        return { scenes, histories }
      }),
  }
})
