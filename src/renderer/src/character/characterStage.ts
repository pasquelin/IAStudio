import type { CharacterExtras } from '@shared/domain/character'
import type { Bounds } from '@/engines/scene/rigFit'
import type { Rig } from '@shared/domain/rig'
import type { SceneState } from '@/engines/scene/sceneState'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { modelNode } from '@/engines/scene/nodeFactory'
import { characterStore, seedCharacter } from '@/stores/character'
import { sceneOf, useScenes } from '@/stores/scenes'
import { openCharacterChannel, type CharacterMessage } from './characterChannel'

/** What a stage needs of an engine: a workshop scene laid over it, and what the file turned out to be. */
export type CharacterDraw = {
  apply: (state: SceneState) => void
  frameContents: () => boolean
}

export type CharacterStageDeps = {
  renderer: CharacterDraw
  assetId: string
}

export type CharacterStage = {
  /** Called by the engine when a model's file has landed — see `SceneRendererOptions.onCharacter`. */
  read: (rig: Rig | null, extras: CharacterExtras | null, bounds: Bounds | null) => void
  close: () => void
}

/**
 * Where a character is edited: the channel end that OWNS the subject.
 *
 * Not a hook, and that is why it exists — `pnpm banc` has no window, and mounts this on a stub
 * renderer. One transport, two callers, so what the window speaks is measured rather than
 * replaced.
 */
export function createCharacterStage(deps: CharacterStageDeps): CharacterStage {
  const channel = openCharacterChannel()
  let framed = false

  // 🛑 Published rather than asked for: every assistant action runs in the STUDIO window, whose
  // own character store is empty — without this the ten skeleton actions reach nothing at all.
  const publish = (rig: Rig | null, bounds: Bounds | null): void => {
    channel.postMessage({
      kind: 'holds',
      assetId: deps.assetId,
      rig,
      bounds,
    } satisfies CharacterMessage)
  }

  // 🛑 A real scene document, in this window's own store: the motion picker, the preview and the
  // blocks it lays are the studio's own surfaces, and they all speak that language. A state kept
  // beside the store would have meant a second copy of every one of them.
  const documentId = workshopIdOf(deps.assetId)
  useScenes.getState().replace(documentId, workshopScene(deps.assetId))
  deps.renderer.apply(sceneOf(useScenes.getState(), documentId))
  // Compared before applying: the store writes a fresh object for every command, every mark and
  // every document — and `apply` sweeps the whole scene each time it is called.
  let last = sceneOf(useScenes.getState(), documentId)
  const watching = useScenes.subscribe(state => {
    const next = sceneOf(state, documentId)
    if (next === last) return

    last = next
    deps.renderer.apply(next)
  })

  return {
    read: (rig, extras, bounds) => {
      seedCharacter(deps.assetId, rig, extras ?? {})
      publish(rig, bounds)
      // Aimed ONCE: re-aiming per landing makes the view breathe as a pose changes the bounds.
      if (!framed) framed = deps.renderer.frameContents()
    },
    close: () => {
      watching()
      // Let go on both sides: the store would otherwise keep every character this window has
      // shown, and an action looking for « the open one » would find the first, for ever.
      channel.postMessage({ kind: 'dropped', assetId: deps.assetId } satisfies CharacterMessage)
      characterStore.use.getState().drop(deps.assetId)
      useScenes.getState().drop(documentId)
      channel.close()
    },
  }
}

/**
 * The character alone, on nothing else.
 *
 * NOT a document: the window edits a file, and a scene it saved would be the second truth this
 * repo forbids. Composed anew on every open, from the asset id and nothing more.
 */
export function workshopScene(assetId: string): SceneState {
  return { ...EMPTY_SCENE, nodes: [modelNode(assetId, assetId)] }
}

/** The document this window's workshop scene lives under — one per character, in its own store. */
export function workshopIdOf(assetId: string): string {
  return `character:${assetId}`
}
