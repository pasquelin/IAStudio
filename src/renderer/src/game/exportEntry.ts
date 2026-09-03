import {
  EXPORTED_GAME_FILE,
  exportedSceneNamed,
  type ExportedGame,
} from '@shared/domain/gameExport'
import { createBundledAssets } from '@game/host/bundledAssets'
import { createExportHost } from '@game/host/exportHost'
import { loadQuickjsScripts } from '@game/host/quickjsScripts'
import { loadJoltPhysics } from '@game/host/joltPhysics'
import type { AssetPort } from '@game/ports/assetPort'
import type { EntityPlacement, RenderPort } from '@game/ports/renderPort'
import type { ScriptModule } from '@game/ports/scriptPort'
import { createGameLoop } from '@game/runtime/gameLoop'
import { placementsOf } from '@game/runtime/placements'
import { sceneFromGltf } from '@/engines/scene/gltfDocument'
import { heightmapFromExr } from '@/engines/scene/heightmap'
import { animationFrames } from './frameDriver'
import { createSceneSwap } from './sceneSwap'
import { veilLift } from './veilLift'
import { createWebRender } from './webRender'
import { heightmapsOf } from './heightmapsOf'
import { worldFromScene } from './worldFromScene'

/**
 * A game running in a browser page, with no studio anywhere.
 *
 * 🛑 The bundle's ONLY entry: `main/export-imports.test.ts` sweeps what it reaches, so React, the
 * stores and Electron cannot arrive here by a shortcut somebody took at three in the morning.
 */
export async function startExportedGame(canvas: HTMLCanvasElement): Promise<() => void> {
  const game = await fetched<ExportedGame>(EXPORTED_GAME_FILE)
  const assets = createBundledAssets(game.assets)
  const render = createWebRender(canvas, assets)
  /** How far the running scene's own TIMELINE has veiled the picture, as of the last step. */
  let veiled = 0
  // 🛑 The host's port and not the renderer's own: read back off the renderer, the arrival fade
  // would hear its own writes and lift itself against them.
  const drawn: RenderPort = {
    place: render.place,
    view: render.view,
    veil: amount => {
      veiled = amount
      render.veil(amount)
    },
  }
  const swap = createSceneSwap()

  const [physics, script, modules] = await Promise.all([
    loadJoltPhysics(),
    loadQuickjsScripts(),
    modulesOf(game),
  ])

  const ports = createExportHost({
    input: canvas,
    player: { id: 'local', name: 'Player', local: true },
    files: game.assets,
    assets,
    physics,
    script,
    render: drawn,
    scenes: swap.port,
  })

  const entry = exportedSceneNamed(game, game.entryScene)
  if (!entry) throw new Error(`no scene "${game.entryScene}" in this game`)

  const opening = sceneFromGltf(await fetched<unknown>(entry.file))
  // 🛑 No `onFault`: the default writes to the log, which the export host echoes to the console.
  // A game with nobody listening is exactly where a swallowed fault costs the most.
  let world = worldFromScene(
    entry.id,
    opening,
    ports,
    { modules },
    1,
    await heightmapsOf(opening.world.layers, id => heightmapFromBundle(assets, id)),
  )
  let loop = createGameLoop(world)
  let warmed = false
  let playing = entry.id
  let reading = false
  let stopped = false
  /** Seconds of veil the scene that has just arrived still owes. */
  let fading = 0
  await render.show(opening)

  /**
   * The scene a running game asked for, put on between two steps — as `playSession` does.
   *
   * 🛑 `settled` only once the file is HERE: settling before the fetch reopens the port for its
   * whole duration, and a trigger asking every step then runs a dozen loads at once, the last
   * one to answer winning.
   */
  async function swapIfAsked(): Promise<void> {
    const request = swap.pending()
    if (!request || reading) return

    // A scene naming itself would rebuild a world and a three.js scene every frame, for ever.
    const wanted = exportedSceneNamed(game, request.scene)
    if (!wanted || wanted.id === playing) {
      swap.settled()
      ports.log.write('warn', `"${request.scene}" is not a scene to go to from here`)
      return
    }

    reading = true
    try {
      const found = sceneFromGltf(await fetched<unknown>(wanted.file))
      if (stopped) return

      world.events.emit({ name: 'SceneLoading', payload: { scene: wanted.id } })
      world.events.drain()
      world.dispose()
      playing = wanted.id
      world = worldFromScene(
        wanted.id,
        found,
        ports,
        { modules },
        1,
        await heightmapsOf(found.world.layers, id => heightmapFromBundle(assets, id)),
      )
      loop = createGameLoop(world)
      // The first step of the arrived scene derives every collider — not a gap to catch up on.
      warmed = false
      // 🛑 BEFORE the build, which suspends for a scene that carves: frames run in that window,
      // stepping the arrived world over the picture of the one just left — and the veil would
      // lift onto it.
      fading = request.fade
      await render.show(found)
      // A second suspension point, so a second look: the stop above threw this world away.
      if (stopped) return

      world.events.emit({ name: 'SceneLoaded', payload: { scene: wanted.id } })
    } finally {
      reading = false
      swap.settled()
    }
  }

  const placements: EntityPlacement[] = []
  const frames = animationFrames()

  frames.start(nowMs => {
    render.resize(canvas.clientWidth, canvas.clientHeight)
    if (loop.advance(nowMs / 1000) > 0 && !warmed) {
      warmed = true
      loop.reset()
    }
    // 🛑 Named and caught: a `game.json` pointing at a file nothing serves would otherwise kill
    // the page by `unhandledRejection`, and a game has no console anybody watches. Asked only
    // when there IS one: two promises a frame, for a request that is almost never there.
    if (swap.pending()) void asked()

    render.place(placementsOf(world, placements, loop.alpha()))
    // The veil the arrived scene came in under, on ITS clock, which a swap restarts at zero.
    if (fading > 0) {
      const lift = veilLift(world.time.elapsed, fading, veiled)
      render.veil(lift.veil)
      if (lift.through) fading = 0
    }
    render.draw()
  })

  async function asked(): Promise<void> {
    try {
      await swapIfAsked()
    } catch (error) {
      ports.log.write('error', `scene load failed: ${String(error)}`)
    }
  }

  return () => {
    // 🛑 Told to the swap in flight too: its continuation would otherwise build a world on a
    // renderer, a physics and a sandbox this line has just thrown away.
    stopped = true
    frames.stop()
    world.dispose()
    ports.input.detach()
    ports.audio.stopAll()
    physics.dispose()
    script.dispose()
    render.dispose()
  }
}

/** Every script of the game, already JavaScript: the studio transpiled them at export time. */
async function modulesOf(game: ExportedGame): Promise<readonly ScriptModule[]> {
  return await Promise.all(
    game.scripts.map(async one => ({ script: one.script, code: await fetchedText(one.file) })),
  )
}

async function fetched<T>(file: string): Promise<T> {
  return (await (await answering(file)).json()) as T
}

const fetchedText = async (file: string): Promise<string> => await (await answering(file)).text()

/** 🛑 A 404 answers a `Response`, not a rejection: read as JSON it would throw somewhere else. */
async function answering(file: string): Promise<Response> {
  const response = await fetch(file)
  if (!response.ok) throw new Error(`${file}: ${response.status}`)
  return response
}

async function heightmapFromBundle(assets: AssetPort, assetId: string) {
  const url = assets.urlOf({ kind: 'asset', id: assetId })
  if (!url) throw new Error(`no file for ${assetId}`)
  return heightmapFromExr(await (await answering(url)).arrayBuffer())
}
