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
import { applyShadowQuality, shadowReachOf, tuneShadowMaps } from '@/engines/scene/shadows'
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
  renderer.shadowMap.enabled = policy.shadows
  applyShadowQuality(renderer, policy.shadowQuality)
  // 🛑 Never on its own: three.js redraws EVERY map of EVERY casting light on every frame it is
  // left to, which a level nobody walks in pays sixty times a second for a picture that does not
  // move. The frames that owe one say so — see `draw`, and `ViewportSurface`, where the editor
  // has held the same rule since it had shadows at all.
  renderer.shadowMap.autoUpdate = false
  const camera = new PerspectiveCamera(policy.fieldOfView, 1, NEAR, VIEW_DISTANCE)
  const veil = veilPass()
  const sized = { width: 0, height: 0 }
  let aimed = false
  let held: GameScene | null = null
  /** Whether the scene the shadow maps hold is no longer the one about to be drawn. */
  let shadowsStale = true
  /**
   * 🛑 Loaded only by a game that HAS effects, and imported dynamically for that: the chain and
   * its three.js passes are weight every other exported game would carry for nothing.
   */
  let composer: PostComposer | null = null
  /** Seconds, off the game's own clock: grain and tape jitter advance on it, never on a wall. */
  let played = 0
  // 🛑 Which build the picture belongs to: a scene arriving while another is still being cut would
  // otherwise have the slower one land on top of it, and the faster one disposed under the draw.
  let building = 0

  return {
    show: async (state, optimization, modelAssets, heightmaps) => {
      const mine = (building += 1)
      const built = await buildGameScene(
        state,
        assets,
        optimization,
        modelAssets,
        gltf.load,
        heightmaps,
      )
      if (mine !== building) {
        built.dispose()
        return
      }

      held?.dispose()
      held = built
      shadowsStale = true
      applyToneMapping(renderer, built.world.toneMapping, built.world.exposure)
      if (policy.shadows) tuneSceneShadows(built.scene, policy)
      if (stackDraws(built.world.post) && !composer) composer = await composerFor(renderer, assets)
      // 🛑 A framing to fall back on: `view(null)` means « flown by hand », which in the studio
      // leaves the viewport's own camera and here would leave one at the origin looking at itself.
      if (!aimed) frameAll(camera, built.scene)
    },

    place: (placements: readonly EntityPlacement[]) => {
      if (placements.length > 0) shadowsStale = true
      for (const placement of placements) {
        held?.place(placement.entity, placement.transform)
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
      played = time / SECOND
      // 🛑 Only when it POSED something: an exported frame seeks on every tick of the clock, so a
      // scene that drives no clip would have owed a depth pass sixty times a second for nothing.
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

      // 🛑 Settled BEFORE the flag is read, never inside it: `||` short-circuits, and a frame
      // that already owed a depth pass would have skipped the pruning entirely.
      const settled = held.flush(camera)
      // three.js clears `needsUpdate` inside the pass it triggers, so this is written per frame.
      renderer.shadowMap.needsUpdate = shadowsStale || settled
      shadowsStale = false
      // The composition the editor draws through, or the plain pass while its chain is still
      // being fetched — a few frames without grade, never a scene nobody sees.
      if (composer && stackDraws(held.world.post)) {
        composer.draw({
          surface: 'game',
          scene: held.scene,
          camera,
          stack: held.world.post,
          target: null,
          width: sized.width,
          height: sized.height,
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
      composer?.dispose()
      composer = null
      gltf.dispose()
      renderer.dispose()
    },
  }
}

/**
 * The editor's own composer, on a game's assets: an effect a scene asks for cannot differ between
 * the two, and `PostComposer` is the one place either draws a composition.
 */
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
 * The shadow pass the editor runs whenever something moved, run ONCE as a scene lands: a game has
 * no instant where the set stops moving, and re-measuring the whole of it per frame is a pass no
 * frame budget holds.
 *
 * 🛑 Its blind spot, written rather than hidden: an entity that walks past what the scene occupied
 * when it loaded walks out of the shadow frustum, and stops throwing.
 */
function tuneSceneShadows(scene: Scene, policy: RenderPolicy): void {
  const lights: Light[] = []
  scene.traverse(object => {
    if (object instanceof Light) lights.push(object)
  })
  tuneShadowMaps(lights, shadowMapSizeFor(policy.quality, policy.shadowMapSize), () =>
    // No grid to fall back on, unlike the editor: a game with nothing in it shades nothing.
    shadowReachOf(new Box3().setFromObject(scene), 0),
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
