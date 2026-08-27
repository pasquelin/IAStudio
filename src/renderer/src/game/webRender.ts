import {
  Box3,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { AssetPort } from '@game/ports/assetPort'
import type { CameraView, EntityPlacement, RenderPort } from '@game/ports/renderPort'
import { applyToneMapping } from '@/engines/scene/worldBinding'
import type { SceneState } from '@/engines/scene/sceneState'
import { buildGameScene, type GameScene } from './gameScene'

export type WebRender = RenderPort & {
  /** Puts another scene on. What a `game.scene.load` lands as, outside the studio. */
  show: (state: SceneState) => void
  resize: (width: number, height: number) => void
  draw: () => void
  dispose: () => void
}

const NEAR = 0.1
const FAR = 2000

/**
 * What draws a game in a browser page — the whole of the studio's viewport that a game needs.
 *
 * 🛑 One `apply`-free port: outside the studio nothing edits, so the scene is built once per
 * load and only the entity poses move. That is what makes an exported frame cheap.
 */
export function createWebRender(canvas: HTMLCanvasElement, assets: AssetPort): WebRender {
  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.shadowMap.enabled = true
  const camera = new PerspectiveCamera(60, 1, NEAR, FAR)
  const veil = veilPass()
  const sized = { width: 0, height: 0 }
  let aimed = false
  let held: GameScene | null = null

  return {
    show: state => {
      held?.dispose()
      held = buildGameScene(state, assets)
      applyToneMapping(renderer, held.world.toneMapping, held.world.exposure)
      // 🛑 A framing to fall back on: `view(null)` means « flown by hand », which in the studio
      // leaves the viewport's own camera and here would leave one at the origin looking at itself.
      if (!aimed) frameAll(camera, held.scene)
    },

    place: (placements: readonly EntityPlacement[]) => {
      for (const placement of placements) {
        const object = held?.byEntity.get(placement.entity)
        if (!object) continue

        const { position, rotation, scale } = placement.transform
        object.position.set(position.x, position.y, position.z)
        object.rotation.set(rotation.x, rotation.y, rotation.z)
        object.scale.set(scale.x, scale.y, scale.z)
      }
    },

    view: (view: CameraView | null) => {
      if (!view) return

      aimed = true
      camera.position.set(view.position.x, view.position.y, view.position.z)
      camera.lookAt(view.target.x, view.target.y, view.target.z)
    },

    veil: amount => {
      veil.material.opacity = Math.min(Math.max(amount, 0), 1)
    },

    // 🛑 Only when it CHANGED: `setSize` reassigns `canvas.width`, which reallocates and clears
    // the framebuffer — sixty times a second at a size nobody touched.
    resize: (width, height) => {
      if (width === sized.width && height === sized.height) return

      sized.width = width
      sized.height = height
      renderer.setPixelRatio(globalThis.devicePixelRatio ?? 1)
      renderer.setSize(width, height, false)
      camera.aspect = height === 0 ? 1 : width / height
      camera.updateProjectionMatrix()
    },

    draw: () => {
      if (!held) return

      renderer.render(held.scene, camera)
      // A second pass rather than a DOM layer: the port owns a canvas and nothing above it.
      if (veil.material.opacity > 0) {
        renderer.autoClear = false
        renderer.render(veil.scene, veil.camera)
        renderer.autoClear = true
      }
    },

    dispose: () => {
      held?.dispose()
      held = null
      veil.dispose()
      renderer.dispose()
    },
  }
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
