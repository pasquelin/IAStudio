import type { DomInputTarget } from '@game/host/domInput'
import type { ScriptModule } from '@game/ports/scriptPort'
import type { ScriptTrouble } from '@/engines/code/scriptCompiler'
import type { RuntimeReport } from '@shared/domain/gameRuntime'
import type { SceneState } from '@/engines/scene/sceneState'
import { gameMessageOf, openGameChannel, type GameCommand } from './gameChannel'
import { startGame } from './gameHost'
import type { PlaySession, SceneLookup } from './playSession'
import type { SceneDraw } from './studioRender'
import { createRuntimeWorldCompiler } from '@/engines/scene/runtimeWorldCompiler'

export type GameStageDeps = {
  /** What draws. The game window's own engine — a WebGL context never crosses a window. */
  renderer: SceneDraw
  /** What the keyboard and the pointer are read off. The window itself, where there is one. */
  input: DomInputTarget
  /** Told what is playing, so a window can title itself and draw its own debug drawer. */
  onReport?: (report: RuntimeReport | null) => void
}

export type GameStage = { close: () => void }

/**
 * Where a game actually runs: the channel end that OWNS the session. Not a hook, and that is why
 * it exists — `pnpm banc` has no window, and mounts this on a stub renderer. One transport, two
 * callers, so what a Play speaks is measured rather than replaced.
 */
export function createGameStage(deps: GameStageDeps): GameStage {
  const channel = openGameChannel()
  const compiler = createRuntimeWorldCompiler()

  let session: PlaySession | null = null
  let documentId: string | null = null
  let scene: SceneState | null = null
  let modules: readonly ScriptModule[] = []
  let troubles: readonly ScriptTrouble[] = []
  let compilationMs = 0
  /** Scenes the studio has answered for, by the name the game asked with. */
  const known = new Map<string, SceneLookup>()
  /** Guards a start against the `play` that overtook it while the engines were landing. */
  let generation = 0

  const report = (one: RuntimeReport): void => {
    if (documentId) channel.postMessage({ kind: 'report', documentId, report: one })
    deps.onReport?.(one)
  }

  const sceneNamed = (name: string): SceneLookup => {
    const held = known.get(name)
    if (held) return held
    // Asked once, and `reading` until the answer lands — the value `startPlay` already waits on.
    known.set(name, 'reading')
    channel.postMessage({ kind: 'want', scene: name })
    return 'reading'
  }

  const drop = (): void => {
    generation += 1
    session?.stop()
    session = null
    documentId = null
    scene = null
    known.clear()
    compiler.clearOptimizationCache()
    deps.onReport?.(null)
  }

  const begin = async (token: number): Promise<void> => {
    const held = scene
    const id = documentId
    if (!held || !id) return

    const started = await startGame({
      documentId: id,
      renderer: deps.renderer,
      // The LATEST published state, never the one captured here: the studio keeps editing.
      editState: () => scene ?? held,
      input: deps.input,
      modules,
      troubles,
      sceneNamed,
      onReport: report,
      compilationMs: () => compilationMs,
    })

    // Overtaken by a later Play, or stopped while the engines were landing.
    if (generation !== token) {
      started.stop()
      return
    }
    session = started
  }

  const runCommand = (command: GameCommand): { ok: boolean; ran: number } => {
    if (!session) return { ok: false, ran: 0 }
    if (command.name === 'step') return { ok: true, ran: session.step(command.steps) }

    if (command.name === 'pause') session.pause()
    else if (command.name === 'resume') session.resume()
    else if (command.name === 'loadScene') session.loadScene(command.scene, command.fade)
    else drop()

    return { ok: true, ran: 0 }
  }

  channel.onmessage = event => {
    const message = gameMessageOf(event.data)
    if (!message) return

    if (message.kind === 'play') {
      // `drop` bumps the generation, which is the token this start is guarded by: a second Play
      // arriving while the engines land drops this one on the floor rather than installing it.
      drop()
      documentId = message.documentId
      scene = compiler.compileRuntimeWorld(message.scene)
      compilationMs = compiler.getOptimizationReport().compilationMs
      modules = message.modules
      troubles = message.troubles
      // 🛑 Applied whole, and it is what the studio's own viewport does on every edit: the render
      // port only ever moves the nodes a step MOVED, so without this the window holds an engine
      // that was never given the scene — measured, and it drew an empty grey window.
      deps.renderer.apply(scene)
      void begin(generation)
      return
    }

    if (message.kind === 'edit') {
      if (message.documentId !== documentId) return
      const compiled = compiler.compileRuntimeRegion(message.patch)
      if (!compiled) return
      scene = compiled
      compilationMs = compiler.getOptimizationReport().compilationMs
      deps.renderer.apply(scene)
      return
    }

    if (message.kind === 'scene') {
      known.set(
        message.scene,
        compiledLookup(message.found, measured => {
          compilationMs = measured
        }),
      )
      return
    }

    if (message.kind === 'command') {
      const answer = runCommand(message.command)
      channel.postMessage({ kind: 'done', id: message.id, ...answer })
      return
    }

    // The studio went away: there is nothing left to play for, and nobody to report to.
    if (message.kind === 'gone') drop()
  }

  // The window opens long after the studio pressed Play, and a channel replays nothing.
  channel.postMessage({ kind: 'ask' })

  return {
    close: () => {
      drop()
      channel.close()
    },
  }
}

function compiledLookup(
  found: SceneLookup,
  onCompilation: (milliseconds: number) => void,
): SceneLookup {
  if (found === 'reading' || found === 'unknown') return found
  const compiler = createRuntimeWorldCompiler()
  const state = compiler.compileRuntimeWorld(found.state)
  onCompilation(compiler.getOptimizationReport().compilationMs)
  return {
    ...found,
    state,
  }
}
