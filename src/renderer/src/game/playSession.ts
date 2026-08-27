import { assetUrl } from '@shared/domain/asset'
import type { PlayState, RuntimeReport } from '@shared/domain/gameRuntime'
import type { DomInputTarget } from '@game/host/domInput'
import { createStudioHost } from '@game/host/studioHost'
import type { PhysicsPort } from '@game/ports/physicsPort'
import type { EntityPlacement } from '@game/ports/renderPort'
import { createGameLoop } from '@game/runtime/gameLoop'
import type { SceneState } from '@/engines/scene/sceneState'
import { createStudioRender, type SceneDraw } from './studioRender'
import { worldFromScene } from './worldFromScene'

/** How often the game says what it is doing. Six times a second, and that is a decision — see
 * `publish`. */
const REPORT_MS = 160

/** What drives the frames. Injected so a test can step them rather than wait for a browser. */
export type FrameDriver = {
  start: (frame: (nowMs: number) => void) => void
  stop: () => void
}

export type PlaySession = {
  state: () => PlayState
  pause: () => void
  resume: () => void
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
}

/**
 * A game running inside the studio.
 *
 * 🛑 The world holds no reference to the document store, so nothing it does can reach the scene
 * being edited. STOP therefore restores nothing — it redraws what was never touched.
 */
export function startPlay(deps: PlaySessionDeps): PlaySession {
  const render = createStudioRender(deps.renderer, deps.editState)
  const ports = createStudioHost({
    input: deps.input,
    player: { id: 'local', name: 'Player', local: true },
    urlForAsset: assetUrl,
    render,
    physics: deps.physics,
  })
  if (!deps.physics) {
    ports.log.write('warn', 'no physics engine: nothing falls, nothing blocks, nobody walks')
  }

  const world = worldFromScene(deps.documentId, deps.editState(), ports)
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
      // The engine holds its bodies in WebAssembly memory, which no collector reaches.
      ports.physics.dispose()
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
