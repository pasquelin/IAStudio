import { assetUrl } from '@shared/domain/asset'
import { clamp } from '@shared/numeric'
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
import { placementsOf } from '@game/runtime/placements'
import type { World } from '@game/runtime/world'
import type { SceneState } from '@/engines/scene/sceneState'
import type { FrameDriver } from './frameDriver'
import { createSceneSwap } from './sceneSwap'
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

/** How long a scene may be « on its way » before the request is given up on. Five seconds. */
const GIVE_UP_FRAMES = 300

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
  /** Which scene the game is IN — the document's until a load, another one after. */
  sceneNow: () => SceneState
  /** Asks for another scene, as a script would. Taken between two steps, like every request. */
  loadScene: (scene: string, fade: number) => void
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
  /**
   * Another scene of the project, by the title or the id a game names it with.
   *
   * Three answers rather than two: a scene the project HOLDS but has not read yet is not a scene
   * it does not have. Absent holds the game to the scene it opened on.
   */
  sceneNamed?: (scene: string) => SceneLookup
}

/**
 * What a project answers about a scene a game asked for.
 *
 * `document` is the id the name RESOLVED to: two names for one level must not read as two levels.
 */
export type SceneLookup = { state: SceneState; document: string } | 'reading' | 'unknown'

/**
 * A game running inside the studio.
 *
 * 🛑 The world holds no reference to the document store, so nothing it does can reach the scene
 * being edited. STOP therefore restores nothing — it redraws what was never touched.
 */
export function startPlay(deps: PlaySessionDeps): PlaySession {
  let veiled = 0
  // 🛑 The scene the GAME is in, which is the document's only until a load. Read per frame, so
  // the viewport follows a swap by the same path it follows an edit.
  let loaded: SceneState | null = null
  const sceneNow = (): SceneState => loaded ?? deps.editState()
  // Wrapped so the session knows whether the runtime ever aimed the camera: a scene loaded in
  // first person aims it even when the one played first was orbited by hand.
  const drawn: SceneDraw = {
    apply: state => deps.renderer.apply(state),
    viewPlacement: () => deps.renderer.viewPlacement(),
    placeView: view => {
      steered = true
      deps.renderer.placeView(view)
    },
  }
  const render = createStudioRender(drawn, sceneNow, amount => {
    veiled = amount
  })
  const swap = createSceneSwap()
  const ports = createStudioHost({
    input: deps.input,
    player: { id: 'local', name: 'Player', local: true },
    urlForAsset: assetUrl,
    render,
    physics: deps.physics,
    script: deps.script,
    scenes: swap.port,
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

  const build = (state: SceneState): World =>
    worldFromScene(deps.documentId, state, ports, { modules: deps.modules ?? [], onFault: noted })

  let world = build(deps.editState())
  let loop = createGameLoop(world)
  // 🛑 Read ALWAYS, put back only if the runtime aimed the camera: a scene loaded mid-game may
  // walk where the one played first orbited, and reading it later would read what a game wrote.
  const watching = deps.renderer.viewPlacement()
  const placements: EntityPlacement[] = []
  let state: PlayState = 'playing'
  /** Seconds of veil a scene that has just arrived still owes. Zero when nothing is fading. */
  let fadeSpan = 0
  /** The edit state as of the last repaint, so an edit of the document under a loaded scene shows. */
  let shown = deps.editState()
  /** Whether the runtime has ever written the viewport's camera — see the restore in `stop`. */
  let steered = false
  /** Frames a request has waited on a file. Five seconds at sixty a second. */
  let waited = 0
  /** Which document the game is playing. Its own until a load takes it somewhere else. */
  let playingDocument = deps.documentId
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

  const draw = (): void => {
    world.ports.render.place(placementsOf(world, placements))
  }

  /**
   * The scene a running game asked for, put on between two steps.
   *
   * 🛑 The old world's systems give back what they took from the engines — bodies, voices,
   * sandbox instances — which a STOP throws away with the engines and a swap must not.
   */
  const swapIfAsked = (): void => {
    const request = swap.pending()
    if (!request) return

    const found = deps.sceneNamed?.(request.scene) ?? 'unknown'
    // Left pending while the file is on its way — giving up at once would make « charge World01 »
    // work only for a level somebody had already opened. 🛑 But BOUNDED: a read that never
    // answers would hold the port for ever, and every later request with it.
    if (found === 'reading' && waited < GIVE_UP_FRAMES) {
      waited += 1
      return
    }

    waited = 0
    if (found === 'reading') {
      swap.settled()
      ports.log.write('warn', `scene "${request.scene}" is taking too long to read`)
      return
    }

    swap.settled()
    if (found === 'unknown') {
      ports.log.write('warn', `no scene named "${request.scene}" in this project`)
      return
    }
    // 🛑 A scene naming itself would rebuild a world every other frame, for ever. A chain of two
    // still can, and nothing here catches that — it needs a budget, not a comparison.
    if (found.document === playingDocument) {
      ports.log.write('warn', `"${request.scene}" is already the scene being played`)
      return
    }

    // 🛑 Heard by a native subscriber, NEVER by a script of the scene that is leaving: the script
    // system queues an event and delivers it on the next step, which this world will not run.
    world.events.emit({ name: 'SceneLoading', payload: { scene: request.scene } })
    world.events.drain()
    world.dispose()

    playingDocument = found.document
    loaded = found.state
    // 🛑 Applied by hand: `studioRender` only repaints what MOVED, and a scene where nothing has
    // moved yet is every scene on its first frame — measured, the viewport kept the old one.
    deps.renderer.apply(found.state)
    shown = deps.editState()
    world = build(found.state)
    loop = createGameLoop(world)
    // The first step of the arrived scene derives every collider, and that hundred milliseconds
    // must not land in the accumulator as six catch-up steps nobody played.
    warmed = false
    world.events.emit({ name: 'SceneLoaded', payload: { scene: request.scene } })
    // Lifted over the fade the request asked for. Zero puts the picture back at once — a `cut`.
    fadeSpan = request.fade
    if (fadeSpan > 0) liftVeil()
    else render.veil(0)
  }

  /**
   * 🛑 The viewport applies the DOCUMENT on any change of it — a click on a node is one — which
   * over a game playing ANOTHER scene wipes it off the screen for good: nothing of the loaded
   * scene changes, so nothing asks for a repaint.
   */
  const redrawIfEdited = (): void => {
    if (loaded === null || deps.editState() === shown) return

    shown = deps.editState()
    deps.renderer.apply(loaded)
  }

  /**
   * The veil coming back up on the scene that has just arrived.
   *
   * On the WORLD's clock, which a swap restarts at zero. Written AFTER the step, so a scene
   * arriving under a fade owns the picture over its own timeline until it is through.
   */
  const liftVeil = (): void => {
    if (fadeSpan <= 0) return

    const left = 1 - world.time.elapsed / fadeSpan
    // The DEEPER of the two: the arriving scene's own timeline has already written its veil this
    // step, and taking the lift alone made the picture jump back to half dark when the lift ended.
    render.veil(Math.max(left, veiled))
    if (left <= 0) fadeSpan = 0
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
      // BETWEEN two steps, never inside one: a world cannot replace itself while it is stepping.
      swapIfAsked()
      redrawIfEdited()
      liftVeil()
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
    sceneNow,
    loadScene: (scene, fade) => swap.port.load(scene, fade),

    pause: () => {
      if (state !== 'playing') return
      state = 'paused'
      // The clock restarts on the next play: a game paused for a minute must not catch up on it.
      last = null
      publish()
    },

    step: steps => {
      if (state !== 'paused') return 0

      const ran = clamp(Math.trunc(steps), 1, MAX_STEPPED)
      for (let at = 0; at < ran; at++) {
        world.step(world.time.step)
        // Taken here too: a game stepped from outside the window is the one a model drives, and
        // a load asked for on step 3 of 120 would otherwise sleep until somebody pressed Play.
        swapIfAsked()
        liftVeil()
      }
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
      // 🛑 `clear`, not `dispose`: the engines are thrown away three lines below, so a STOP has
      // nothing to give back — and a `dispose` would run every `onDestroy` on the way out.
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
      // The camera is the only studio state a game touches, so it is the only one STOP restores —
      // and only when it was touched, or a STOP would undo an orbit made by hand during the game.
      if (steered) deps.renderer.placeView(watching)
      publish()
    },
  }
}
