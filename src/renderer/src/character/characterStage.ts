import type { CharacterExtras } from '@shared/domain/character'
import type { Rig } from '@shared/domain/rig'
import type { SceneState } from '@/engines/scene/sceneState'
import { EMPTY_SCENE } from '@/engines/scene/sceneState'
import { modelNode } from '@/engines/scene/nodeFactory'
import { seedCharacter } from '@/stores/character'
import { sceneOf, useScenes } from '@/stores/scenes'
import { characterMessageOf, openCharacterChannel } from './characterChannel'

/** What a stage needs of an engine: a workshop scene laid over it, and what the file turned out to be. */
export type CharacterDraw = {
  apply: (state: SceneState) => void
  frameContents: () => boolean
}

export type CharacterStageDeps = {
  renderer: CharacterDraw
  assetId: string
  /** Told what the catalogue calls this character, once the studio has answered. */
  onName?: (name: string) => void
  /** Told the studio went away, which leaves this window with a file and nobody to ask. */
  onGone?: () => void
}

export type CharacterStage = {
  /** Called by the engine when a model's file has landed — see `SceneRendererOptions.onCharacter`. */
  read: (rig: Rig | null, extras: CharacterExtras | null) => void
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

  channel.onmessage = event => {
    const message = characterMessageOf(event.data)
    if (!message) return
    if (message.kind === 'gone') {
      deps.onGone?.()
      return
    }
    // Every message names its character, and a window turned towards another one drops it: the
    // channel is shared, and a studio may answer for a subject this window no longer holds.
    if (!('assetId' in message) || message.assetId !== deps.assetId) return
    if (message.kind === 'subject') deps.onName?.(message.name)
  }

  // Asked rather than waited for: a channel replays nothing, and this window opens well after
  // the studio pressed the button that made it.
  channel.postMessage({ kind: 'ask', assetId: deps.assetId })

  // 🛑 A real scene document, in this window's own store: the motion picker, the preview and the
  // blocks it lays are the studio's own surfaces, and they all speak that language. A state kept
  // beside the store would have meant a second copy of every one of them.
  const documentId = workshopIdOf(deps.assetId)
  useScenes.getState().replace(documentId, workshopScene(deps.assetId))
  deps.renderer.apply(sceneOf(useScenes.getState(), documentId))
  const watching = useScenes.subscribe(state => deps.renderer.apply(sceneOf(state, documentId)))

  return {
    read: (rig, extras) => {
      seedCharacter(deps.assetId, rig, extras ?? {})
      // Aimed ONCE: re-aiming per landing makes the view breathe as a pose changes the bounds.
      if (!framed) framed = deps.renderer.frameContents()
    },
    close: () => {
      watching()
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
