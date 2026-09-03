import { orElse } from '@shared/promises'
import type { DomInputTarget } from '@game/host/domInput'
import { loadJoltPhysics } from '@game/host/joltPhysics'
import { loadQuickjsScripts } from '@game/host/quickjsScripts'
import type { ScriptModule } from '@game/ports/scriptPort'
import type { RuntimeReport } from '@shared/domain/gameRuntime'
import type { ScriptTrouble } from '@/engines/code/scriptCompiler'
import type { SceneState } from '@/engines/scene/sceneState'
import { animationFrames } from './frameDriver'
import { heightmapsOf } from './heightmapsOf'
import { startPlay, type PlaySession, type SceneLookup } from './playSession'
import type { SceneDraw } from './studioRender'

export type GameHostDeps = {
  documentId: string
  renderer: SceneDraw
  /** Read on every frame rather than captured: the document may be edited while a game runs. */
  editState: () => SceneState
  input: DomInputTarget
  /** Already transpiled by the STUDIO, never here — see `gameChannel`. */
  modules: readonly ScriptModule[]
  troubles: readonly ScriptTrouble[]
  /** Another scene of the project. `reading` is the answer while the studio is being asked. */
  sceneNamed: (scene: string) => SceneLookup
  onReport: (report: RuntimeReport) => void
}

/**
 * Starts a game, wherever the picture is. 🛑 The engines first, the world second — 2,7 Mo of
 * WebAssembly landing in 27 ms, a frame nobody sees but not a wait a button takes synchronously.
 */
export async function startGame(deps: GameHostDeps): Promise<PlaySession> {
  // The two machines together, each failing on its own: they are independent, and a game whose
  // physics did not land still runs — it says so in its own log. The heightmaps ride along.
  const [physics, script, heightmaps] = await Promise.all([
    orElse(loadJoltPhysics(), undefined),
    orElse(loadQuickjsScripts(), undefined),
    heightmapsOf(deps.editState().world.layers),
  ])

  return startPlay({
    documentId: deps.documentId,
    renderer: deps.renderer,
    editState: deps.editState,
    input: deps.input,
    frames: animationFrames(),
    physics,
    script,
    modules: deps.modules,
    troubles: deps.troubles,
    sceneNamed: deps.sceneNamed,
    onReport: deps.onReport,
    heightmaps,
  })
}
