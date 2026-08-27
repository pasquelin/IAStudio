import { assetUrl } from '@shared/domain/asset'
import type { PlayState, RuntimeError, RuntimeReport } from '@shared/domain/gameRuntime'
import type { DomInputTarget } from '@game/host/domInput'
import { createStudioHost } from '@game/host/studioHost'
import { refToString } from '@shared/domain/ref'
import type { AudioPort } from '@game/ports/audioPort'
import type { PhysicsPort } from '@game/ports/physicsPort'
import type { ScriptModule, ScriptPort } from '@game/ports/scriptPort'
import type { ScriptFault } from '@game/script/frame'
import type { ScriptTrouble } from '@/engines/code/scriptCompiler'
import type { EntityPlacement } from '@game/ports/renderPort'
import { createGameLoop } from '@game/runtime/gameLoop'
import type { SceneState } from '@/engines/scene/sceneState'
import { createStudioRender, type SceneDraw } from './studioRender'
import { worldFromScene } from './worldFromScene'

/** How often the game says what it is doing. Six times a second, and that is a decision — see
 * `publish`. */
const REPORT_MS = 160

/** As many faults as the log keeps lines: enough to read one back, short enough to hold. */
const ERRORS_KEPT = 200

/**
 * How many steps ONE call may run. Two seconds of game at sixty a second — enough to watch a
 * fall land, short enough that a client cannot freeze the window by asking for a million.
 */
const MAX_STEPPED = 120

/**
 * The fault as something a reader can OPEN — the script by its own reference, the entity by the
 * one naming the document it lives in, which a node id alone does not.
 */
const addressed = (fault: ScriptFault, documentId: string): RuntimeError => ({
  script: fault.script,
  entity: fault.entity
    ? refToString({ kind: 'entity', document: documentId, id: fault.entity })
    : null,
  message: fault.message,
  line: fault.line,
  column: fault.column,
  at: Date.now(),
})

/** What drives the frames. Injected so a test can step them rather than wait for a browser. */
export type FrameDriver = {
  start: (frame: (nowMs: number) => void) => void
  stop: () => void
}

export type PlaySession = {
  state: () => PlayState
  pause: () => void
  resume: () => void
  /**
   * Runs that many FIXED steps and draws once, whatever the clock says.
   *
   * 🛑 For whoever watches from outside — a model, a test — rather than for the game: a reading
   * taken while sixty frames a second run is a reading of a different world each time. Only
   * while PAUSED, so it never races the loop that is already stepping.
   */
  step: (steps: number) => number
  /** Drops the world and puts the viewport back on the edit state. Nothing to restore. */
  stop: () => void
}

export type PlaySessionDeps = {
  documentId: string
  renderer: SceneDraw
  /** Read on every frame rather than captured: the document may be edited while a game runs. */
  editState: () => SceneState
  input: DomInputTarget
  onReport: (report: RuntimeReport) => void
  frames: FrameDriver
  /** What simulates. Absent leaves the game inert — nothing falls and nothing blocks. */
  physics?: PhysicsPort
  /** Where a game's own code runs. Absent leaves every script silent. */
  script?: ScriptPort
  /** Already transpiled by the studio: the sandbox runs JavaScript, an author writes TypeScript. */
  modules?: readonly ScriptModule[]
  /** What would not compile at all, said the way a fault is: the reader can OPEN it. */
  troubles?: readonly ScriptTrouble[]
  /** What sounds. Absent leaves a game silent — no mixer is wired to a Play yet. */
  audio?: AudioPort
}

/**
 * A game running inside the studio.
 *
 * 🛑 The world holds no reference to the document store, so nothing it does can reach the scene
 * being edited. STOP therefore restores nothing — it redraws what was never touched.
 */
export function startPlay(deps: PlaySessionDeps): PlaySession {
  let veiled = 0
  const render = createStudioRender(deps.renderer, deps.editState, amount => {
    veiled = amount
  })
  const ports = createStudioHost({
    input: deps.input,
    player: { id: 'local', name: 'Player', local: true },
    urlForAsset: assetUrl,
    render,
    physics: deps.physics,
    script: deps.script,
    audio: deps.audio,
  })
  if (!deps.physics) {
    ports.log.write('warn', 'no physics engine: nothing falls, nothing blocks, nobody walks')
  }

  // Bounded like the log, and for the same reason: a script failing every step writes without end.
  const errors: RuntimeError[] = []
  const noted = (fault: ScriptFault): void => {
    errors.push(addressed(fault, deps.documentId))
    if (errors.length > ERRORS_KEPT) errors.shift()
  }
  // 🛑 Said on the SAME channel as a fault, rather than as a module that logs its own refusal: a
  // file nothing references would otherwise never say a word.
  for (const trouble of deps.troubles ?? []) {
    noted({
      script: trouble.script,
      entity: null,
      message: trouble.message,
      line: trouble.line,
      column: 0,
    })
  }

  const world = worldFromScene(deps.documentId, deps.editState(), ports, {
    modules: deps.modules ?? [],
    onFault: noted,
  })
  const loop = createGameLoop(world)
  // The one piece of studio state a game DOES write, and only when the set is not flown by hand:
  // in `orbit` the runtime never touches the camera, so a STOP must not undo what a hand orbited.
  const watching = world.play.camera === 'orbit' ? null : deps.renderer.viewPlacement()
  // Reused across frames: one object per entity per frame is the only allocation a still game
  // would otherwise make.
  const placements: EntityPlacement[] = []
  let state: PlayState = 'playing'
  let frameMs = 0
  let last: number | null = null
  let warmed = false
  let said = Number.NEGATIVE_INFINITY

  const publish = (): void =>
    deps.onReport({
      state,
      tick: world.time.tick,
      fps: frameMs > 0 ? 1000 / frameMs : 0,
      frameMs,
      entities: world.entities.count(),
      logs: ports.log.recent(),
      errors: [...errors],
      veil: veiled,
    })

  /**
   * 🛑 Not on every frame. `onReport` writes into a store the panel subscribes to, so publishing at
   * sixty hertz re-renders the transport — its four lookups, its formatter and its filter — on
   * every frame of every game. Six times a second is faster than an eye reads a counter, and what
   * CHANGES state says so at once through `publish`.
   */
  const publishIfDue = (nowMs: number): void => {
    if (nowMs - said < REPORT_MS) return
    said = nowMs
    publish()
  }

  /**
   * Every entity, every frame — the port is what decides whether anything has to be redrawn, and
   * it holds the shadow that answers that. One comparison there beats one here and one there.
   */
  const draw = (): void => {
    let count = 0
    for (const entity of world.entities.all()) {
      const held = placements[count]
      if (held) {
        held.entity = entity.id
        held.transform = entity.transform
      } else {
        placements.push({ entity: entity.id, transform: entity.transform })
      }
      count += 1
    }
    placements.length = count
    world.ports.render.place(placements)
  }

  deps.frames.start(nowMs => {
    if (state === 'playing') {
      // Smoothed rather than read raw: a figure that jumps every frame is one nobody can read.
      if (last !== null)
        frameMs = frameMs === 0 ? nowMs - last : frameMs * 0.9 + (nowMs - last) * 0.1
      last = nowMs

      // 🛑 Forgotten after the first step ran: that step derives every collider, and a hundred
      // milliseconds of it lands in the accumulator, which then owes six catch-up steps nobody
      // played.
      if (loop.advance(nowMs / 1000) > 0 && !warmed) {
        warmed = true
        loop.reset()
      }
    }

    // 🛑 Drawn even while PAUSED, and the frames keep coming for it: the viewport re-applies the
    // document on any change — a click on a node is one, the selection being part of the state —
    // and a paused game that stopped drawing would snap back to the authored pose and stay there.
    draw()
    publishIfDue(nowMs)
  })

  publish()

  return {
    state: () => state,

    pause: () => {
      if (state !== 'playing') return
      state = 'paused'
      // The clock restarts on the next play: a game paused for a minute must not catch up on it.
      last = null
      publish()
    },

    step: steps => {
      if (state !== 'paused') return 0

      const ran = Math.max(1, Math.min(Math.trunc(steps), MAX_STEPPED))
      for (let at = 0; at < ran; at++) world.step(world.time.step)
      world.lateUpdate(0)
      draw()
      publish()
      return ran
    },

    resume: () => {
      if (state !== 'paused') return
      state = 'playing'
      // The world's clock forgets the pause too: the clamp alone would still owe it a quarter
      // of a second of gameplay, which is fifteen steps nobody played.
      loop.reset()
      publish()
    },

    stop: () => {
      said = Number.NEGATIVE_INFINITY
      state = 'edit'
      deps.frames.stop()
      world.events.clear()
      ports.input.detach()
      // 🛑 The sounds first, and the veil down: a STOP in the middle of a fade would otherwise
      // leave the picture dark — `apply` puts the document back, not the veil — and a sound
      // started by a row would play on until the window closed.
      ports.audio.stopAll()
      veiled = 0
      // Both hold WebAssembly memory no collector reaches, and both are built per PLAY: a
      // sandbox left open keeps every compiled module of the session it belonged to.
      ports.physics.dispose()
      ports.script.dispose()
      deps.renderer.apply(deps.editState())
      // The camera is the only studio state a game touches, so it is the only one STOP restores.
      if (watching) deps.renderer.placeView(watching)
      publish()
    },
  }
}

/** The browser's own frames. Named apart so nothing but the studio's own start depends on one. */
export function animationFrames(): FrameDriver {
  let handle: number | null = null

  return {
    start: frame => {
      const tick = (nowMs: number): void => {
        handle = requestAnimationFrame(tick)
        frame(nowMs)
      }
      handle = requestAnimationFrame(tick)
    },
    stop: () => {
      if (handle !== null) cancelAnimationFrame(handle)
      handle = null
    },
  }
}
