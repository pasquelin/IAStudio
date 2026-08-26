import { assetUrl } from '@shared/domain/asset'
import type { PlayState, RuntimeReport } from '@shared/domain/gameRuntime'
import type { DomInputTarget } from '@game/host/domInput'
import { createStudioHost } from '@game/host/studioHost'
import type { EntityPlacement } from '@game/ports/renderPort'
import { createGameLoop } from '@game/runtime/gameLoop'
import type { SceneState } from '@/engines/scene/sceneState'
import { createStudioRender, type SceneDraw } from './studioRender'
import { worldFromScene } from './worldFromScene'

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
  })

  const world = worldFromScene(deps.documentId, deps.editState(), ports)
  const loop = createGameLoop(world)
  // Reused across frames: one object per entity per frame is the only allocation a still game
  // would otherwise make.
  const placements: EntityPlacement[] = []
  let state: PlayState = 'playing'
  let frameMs = 0
  let last: number | null = null

  const publish = (): void =>
    deps.onReport({
      state,
      tick: world.time.tick,
      fps: frameMs > 0 ? 1000 / frameMs : 0,
      frameMs,
      entities: world.entities.count(),
      logs: ports.log.recent(),
    })

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
    if (state !== 'playing') return

    // Smoothed rather than read raw: a figure that jumps every frame is one nobody can read.
    if (last !== null) frameMs = frameMs === 0 ? nowMs - last : frameMs * 0.9 + (nowMs - last) * 0.1
    last = nowMs

    loop.advance(nowMs / 1000)
    draw()
    publish()
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
      state = 'edit'
      deps.frames.stop()
      world.events.clear()
      ports.input.detach()
      deps.renderer.apply(deps.editState())
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
