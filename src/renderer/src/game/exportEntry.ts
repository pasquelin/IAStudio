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
import { secondsToUs } from '@shared/domain/time'
import { answering, exportedJson, exportedText } from './exportedResponse'
import { expandCompressedAssets } from './exportedAssets'
import { createStartupRollback, failStartup } from './startupRollback'
/**
 * A game running in a browser page, with no studio anywhere.
 *
 * 🛑 The bundle's ONLY entry: `main/export-imports.test.ts` sweeps what it reaches, so React, the
 * stores and Electron cannot arrive here by a shortcut somebody took at three in the morning.
 */
export async function startExportedGame(canvas: HTMLCanvasElement): Promise<() => void> {
  const game = await exportedJson<ExportedGame>(EXPORTED_GAME_FILE)
  const expandedAssets = await expandCompressedAssets(game.assets, game.compressedAssets ?? [])
  const rollback = createStartupRollback()
  rollback.add(expandedAssets.dispose)
  try {
    const assets = createBundledAssets(expandedAssets.files)
    const render = createWebRender(canvas, assets)
    rollback.add(render.dispose)
    const drawn = createDrawnPort(render)
    const swap = createSceneSwap()
    async function portsOf() {
      return createPorts(canvas, game, assets, drawn.port, swap.port, rollback)
    }
    const { ports, modules } = await portsOf()

    const openingScene = await createOpeningScene(game, assets, ports, modules)
    const { entry, opening } = openingScene
    let { world } = openingScene
    rollback.add(() => world.dispose())
    let loop = createGameLoop(world)
    let warmed = false
    let playing = entry.id
    let reading = false
    let stopped = false
    /** Seconds of veil the scene that has just arrived still owes. */
    let fading = 0
    await render.show(opening, optimizationOf(entry.optimization, game.modelAssets))

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
        const found = sceneFromGltf(await exportedJson<unknown>(wanted.file, wanted.compression))
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
        await render.show(found, optimizationOf(wanted.optimization, game.modelAssets))
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
      render.seek(secondsToUs(world.time.elapsed))
      // The veil the arrived scene came in under, on ITS clock, which a swap restarts at zero.
      if (fading > 0) {
        const lift = veilLift(world.time.elapsed, fading, drawn.veiled())
        render.veil(lift.veil)
        if (lift.through) fading = 0
      }
      render.draw()
    })
    rollback.add(frames.stop)

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
      rollback.dispose()
    }
  } catch (error) {
    failStartup(rollback, error)
  }
}

function createDrawnPort(render: ReturnType<typeof createWebRender>): {
  port: RenderPort
  veiled: () => number
} {
  let veiled = 0
  return {
    port: {
      place: render.place,
      view: render.view,
      veil: amount => {
        veiled = amount
        render.veil(amount)
      },
    },
    veiled: () => veiled,
  }
}

async function createPorts(
  canvas: HTMLCanvasElement,
  game: ExportedGame,
  assets: ReturnType<typeof createBundledAssets>,
  render: RenderPort,
  scenes: ReturnType<typeof createSceneSwap>['port'],
  rollback: ReturnType<typeof createStartupRollback>,
) {
  const physics = await loadJoltPhysics()
  rollback.add(physics.dispose)
  const script = await loadQuickjsScripts()
  rollback.add(script.dispose)
  const modules = await modulesOf(game)
  const ports = createExportHost({
    input: canvas,
    player: { id: 'local', name: 'Player', local: true },
    files: game.assets,
    assets,
    physics,
    script,
    render,
    scenes,
  })
  rollback.add(() => {
    ports.input.detach()
    ports.audio.stopAll()
  })
  return { ports, modules }
}

async function createOpeningScene(
  game: ExportedGame,
  assets: ReturnType<typeof createBundledAssets>,
  ports: ReturnType<typeof createExportHost>,
  modules: readonly ScriptModule[],
) {
  const entry = exportedSceneNamed(game, game.entryScene)
  if (!entry) throw new Error(`no scene "${game.entryScene}" in this game`)
  const opening = sceneFromGltf(await exportedJson<unknown>(entry.file, entry.compression))
  const world = worldFromScene(
    entry.id,
    opening,
    ports,
    { modules },
    1,
    await heightmapsOf(opening.world.layers, id => heightmapFromBundle(assets, id)),
  )
  return { entry, opening, world }
}

function optimizationOf(
  scene: ExportedGame['scenes'][number]['optimization'],
  modelAssets: ExportedGame['modelAssets'],
) {
  if (!scene && !modelAssets) return undefined
  return { nodes: scene?.nodes ?? [], ...(modelAssets ? { modelAssets } : {}) }
}
/** Every script of the game, already JavaScript: the studio transpiled them at export time. */
async function modulesOf(game: ExportedGame): Promise<readonly ScriptModule[]> {
  return await Promise.all(
    game.scripts.map(async one => ({
      script: one.script,
      code: await exportedText(one.file, one.compression),
    })),
  )
}
async function heightmapFromBundle(assets: AssetPort, assetId: string) {
  const url = assets.urlOf({ kind: 'asset', id: assetId })
  if (!url) throw new Error(`no file for ${assetId}`)
  return heightmapFromExr(await (await answering(url)).arrayBuffer())
}
