import type { ClipSource } from '@shared/domain/scene'
import {
  Box3,
  Light,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { clamp } from '@shared/numeric'
import type { AssetPort } from '@game/ports/assetPort'
import type { CameraView, EntityPlacement, RenderPort } from '@game/ports/renderPort'
import { applyToneMapping } from '@/engines/scene/worldBinding'
import { applyShadowPolicy, tuneShadowMaps } from '@/engines/scene/shadows'
import { gameShadowReach } from './gameSceneShadows'
import { pixelRatioFor, shadowMapSizeFor } from '@/engines/scene/viewportQuality'
import {
  DEFAULT_RENDER_POLICY,
  VIEW_DISTANCE,
  type RenderPolicy,
} from '@shared/domain/renderPolicy'
import type { SceneState } from '@/engines/scene/sceneState'
import type { HeightmapSamples } from '@shared/domain/heightmap'
import type { CompiledModelMesh, CompiledSceneOptimization } from '@shared/domain/gameExport'
import { buildGameScene, type GameScene } from './gameScene'
import { createGltfSource } from '@/engines/scene/gltfSource'
import { SECOND, type Us } from '@shared/domain/time'
import { stackDraws } from '@shared/domain/postProcessing'
import { loadLutFrom } from '@/engines/postfx/lutSource'
import type { PostComposer } from '@/engines/postfx/PostComposer'

export type WebRender = RenderPort & {
  /** Puts another scene on. What a `game.scene.load` lands as, outside the studio. */
  show: (
    state: SceneState,
    optimization?: CompiledSceneOptimization,
    modelAssets?: Readonly<Record<string, readonly CompiledModelMesh[]>>,
    heightmaps?: ReadonlyMap<string, HeightmapSamples>,
    clipsForNode?: (nodeId: string) => readonly ClipSource[],
  ) => Promise<void>
  resize: (width: number, height: number) => void
  draw: () => void
  seek: (time: Us) => void
  dispose: () => void
}

const NEAR = 0.1

/**
 * What draws a game in a browser page — the whole of the studio's viewport that a game needs.
 *
 * 🛑 One `apply`-free port: outside the studio nothing edits, so the scene is built once per
 * load and only the entity poses move. That is what makes an exported frame cheap.
 */
export function createWebRender(
  canvas: HTMLCanvasElement,
  assets: AssetPort,
  /** What the author saw. Absent in an export written before it was carried — see its default. */
  policy: RenderPolicy = DEFAULT_RENDER_POLICY,
): WebRender {
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  const gltf = createGltfSource(() => renderer)
  applyShadowPolicy(renderer, policy)
  const camera = new PerspectiveCamera(policy.fieldOfView, 1, NEAR, VIEW_DISTANCE)
  const veil = veilPass()
  const sized = { width: 0, height: 0 }
  let aimed = false
  let held: GameScene | null = null
  /** Whether the scene the shadow maps hold is no longer the one about to be drawn. */
  let shadowsStale = true
  /** 🛑 Dynamic: its three.js passes are weight every game without effects would carry for nothing. */
  const chain = composerHold(renderer, assets)
  /** Seconds, off the game's own clock: grain and tape jitter advance on it, never on a wall. */
  let played = 0
  let sought: Us | null = null
  // 🛑 Which build the picture belongs to: a scene arriving while another is still being cut would
  // otherwise have the slower one land on top of it, and the faster one disposed under the draw.
  let building = 0

  return {
    show: async (state, optimization, modelAssets, heightmaps, clipsForNode) => {
      const mine = (building += 1)
      const built = await buildGameScene(
        state,
        assets,
        optimization,
        modelAssets,
        gltf.load,
        heightmaps,
        clipsForNode,
      )
      if (mine !== building) {
        built.dispose()
        return
      }

      held?.dispose()
      held = built
      shadowsStale = true
      applyToneMapping(renderer, built.world.toneMapping, built.world.exposure)
      // 🛑 Two boxes, not one: a frustum is cut to what DRAWS, a framing to everything there is.
      // Sharing them spread a single shadow map over a whole scatter layer.
      if (policy.shadows) tuneSceneShadows(built, policy)
      // 🛑 A framing to fall back on: `view(null)` means « flown by hand », which in the studio
      // leaves the viewport's own camera and here would leave one at the origin looking at itself.
      if (!aimed) frameAll(camera, built.scene)
      // Last, and never fatal: a chain that fails to arrive leaves a scene drawn ungraded, where
      // a throw here would leave a page showing nothing at all.
      if (stackDraws(built.world.post)) await chain.load()
      // The build may have been thrown away while that chain was in flight.
      if (mine !== building) return

      // 🛑 What the scene that just left was drawn through: kept, a chain holds two full-screen
      // targets, and a game moving between N shapes of stack would hold N of them until the page
      // closed — the editor sweeps for the same reason on every view it drops.
      chain.current()?.sweep([built.world.post])
    },

    place: (placements: readonly EntityPlacement[]) => {
      // 🛑 On what MOVED, never on the call: a game hands over every entity of the world on every
      // frame, so arming on `length` redrew every shadow map of a level nobody was walking in.
      for (const placement of placements) {
        if (held?.place(placement.entity, placement.transform) === true) shadowsStale = true
      }
    },

    view: (view: CameraView | null) => {
      if (!view) return

      aimed = true
      camera.position.set(view.position.x, view.position.y, view.position.z)
      camera.lookAt(view.target.x, view.target.y, view.target.z)
    },

    veil: amount => {
      veil.material.opacity = clamp(amount, 0, 1)
    },

    seek: time => {
      // 🛑 On a head that MOVED, and only then: an exported frame seeks on every tick of its
      // clock, so a paused game would have posed and owed a depth pass sixty times a second.
      if (time === sought) return

      sought = time
      played = time / SECOND
      if (held?.seek(time) === true) shadowsStale = true
    },

    // 🛑 Only when it CHANGED: `setSize` reassigns `canvas.width`, which reallocates and clears
    // the framebuffer — sixty times a second at a size nobody touched.
    resize: (width, height) => {
      if (width === sized.width && height === sized.height) return

      sized.width = width
      sized.height = height
      // What the quality level pays for, held to the screen's own — the editor's very rule. The
      // whole device ratio was four times the pixels of a `performance` viewport, unasked.
      renderer.setPixelRatio(
        Math.min(pixelRatioFor(policy.quality), globalThis.devicePixelRatio ?? 1),
      )
      renderer.setSize(width, height, false)
      camera.aspect = height === 0 ? 1 : width / height
      camera.updateProjectionMatrix()
    },

    draw: () => {
      if (!held) return

      // 🛑 Settled BEFORE the flag is read: `||` short-circuits, and a frame already owing a
      // depth pass would have skipped the pruning entirely.
      const changed = held.flush(camera)
      // three.js clears `needsUpdate` inside the pass it triggers, so this is written per frame.
      renderer.shadowMap.needsUpdate = shadowsStale || changed
      shadowsStale = false
      // The composition the editor draws through, or the plain pass while its chain is still
      // being fetched — a few frames without grade, never a scene nobody sees.
      const composer = chain.current()
      if (composer && stackDraws(held.world.post)) {
        composer.draw({
          surface: 'game',
          scene: held.scene,
          camera,
          stack: held.world.post,
          target: null,
          // 🛑 DEVICE pixels, as `ViewportDrawing` hands them: `sized` is CSS, and a chain built
          // from it would compose the frame at a fraction of the canvas and blur it.
          width: Math.round(sized.width * renderer.getPixelRatio()),
          height: Math.round(sized.height * renderer.getPixelRatio()),
          quality: policy.quality,
          toneMapped: held.world.toneMapping !== 'none',
          time: played,
        })
      } else renderer.render(held.scene, camera)
      // A second pass rather than a DOM layer: the port owns a canvas and nothing above it.
      if (veil.material.opacity > 0) {
        renderer.autoClear = false
        renderer.render(veil.scene, veil.camera)
        renderer.autoClear = true
      }
    },

    dispose: () => {
      // The build in flight with it: what it lands on has just been thrown away.
      building += 1
      held?.dispose()
      held = null
      veil.dispose()
      chain.dispose()
      gltf.dispose()
      renderer.dispose()
    },
  }
}

/**
 * The one composer a page ever builds, held as its PROMISE: two scenes landing together read a
 * null `current` before either had awaited one, and built two.
 *
 * 🛑 A failure is nothing, never a throw: `show` is awaited by the page's startup, so a chunk that
 * never arrives showed no game at all. The rejected promise is dropped, so a later scene retries.
 */
function composerHold(renderer: WebGLRenderer, assets: AssetPort) {
  let held: PostComposer | null = null
  let loading: Promise<PostComposer> | null = null

  return {
    current: () => held,
    load: async (): Promise<void> => {
      try {
        held = await (loading ??= composerFor(renderer, assets))
      } catch {
        loading = null
      }
    },
    dispose: () => {
      held?.dispose()
      held = null
      loading = null
    },
  }
}

/** The editor's own composer, on a game's assets: an effect cannot differ between the two. */
async function composerFor(renderer: WebGLRenderer, assets: AssetPort): Promise<PostComposer> {
  const { PostComposer: Composer } = await import('@/engines/postfx/PostComposer')
  return new Composer(renderer, {
    loadLut: async assetId => {
      const url = assets.urlOf({ kind: 'asset', id: assetId })
      return url === null ? null : await loadLutFrom(url)
    },
  })
}

/**
 * Run ONCE as a scene lands, where the editor runs it on every move. 🛑 Its blind spot: an entity
 * walking past what the scene occupied at load walks out of the frustum and stops throwing.
 */
function tuneSceneShadows(built: GameScene, policy: RenderPolicy): void {
  const lights: Light[] = []
  built.scene.traverse(object => {
    if (object instanceof Light) lights.push(object)
  })
  tuneShadowMaps(lights, shadowMapSizeFor(policy.quality, policy.shadowMapSize), () =>
    gameShadowReach(built.shadowBounds),
  )
}

/** A black sheet across the frame, drawn over the scene at the veil's own opacity. */
function veilPass() {
  const material = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
  const geometry = new PlaneGeometry(2, 2)
  const scene = new Scene()
  scene.add(new Mesh(geometry, material))
  return {
    scene,
    camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1),
    material,
    dispose: () => {
      geometry.dispose()
      material.dispose()
    },
  }
}

/** Everything in frame, for a scene nobody walks: what the studio's own « frame all » does. */
function frameAll(camera: PerspectiveCamera, scene: Scene): void {
  const bounds = new Box3().setFromObject(scene)
  if (bounds.isEmpty()) return

  const middle = bounds.getCenter(new Vector3())
  const across = bounds.getSize(new Vector3()).length()
  camera.position.set(middle.x, middle.y + across * 0.3, middle.z + across)
  camera.lookAt(middle)
}
