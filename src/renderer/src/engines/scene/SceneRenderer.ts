import {
  Color,
  DirectionalLight,
  GridHelper,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SpotLight,
  Vector2,
  Vector3 as ThreeVector3,
  WebGLRenderer,
  type Light,
  type Object3D,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import type { MotionId } from '@shared/domain/shortcut'
import { token } from '../core/palette'
import type { SceneNode, SceneState, Transform } from './scene-state'
import { geometryFor, helperFor, lightFor, tuneViewHelper, type LightHelper } from './three-factory'

/** `select` clicks without arming a gizmo — the mode you come back to. */
export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale'

export type SceneRendererOptions = {
  onSelect: (id: string | null) => void
  onTransform: (id: string, transform: Transform) => void
}

const FLY_SPEED = 4
const BOOST_FACTOR = 3
const GRID_SIZE = 20

/** Scratch vectors for the fly loop, which runs every frame while a direction is held. */
const forward = new ThreeVector3()
const right = new ThreeVector3()
const step = new ThreeVector3()

/**
 * The three.js side of a scene. It owns no truth: `apply` reflects a state it never computes,
 * so the whole thing can be thrown away and rebuilt — which is exactly what changing workspace
 * does to it.
 */
export class SceneRenderer {
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(60, 1, 0.1, 1000)
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly objects = new Map<string, Object3D>()
  private readonly helpers = new Map<string, LightHelper>()
  /** Last node applied per id, compared by reference to skip what has not changed. */
  private readonly applied = new Map<string, SceneNode>()
  private readonly held = new Set<MotionId>()

  private renderer: WebGLRenderer | null = null
  private orbit: OrbitControls | null = null
  private gizmo: TransformControls | null = null
  private viewHelper: ViewHelper | null = null
  private grid: GridHelper | null = null
  private observer: ResizeObserver | null = null
  private frame: number | null = null
  private flying = false
  private lastTime = 0
  private mode: TransformMode = 'select'
  /** Held so leaving `select` can re-arm the gizmo without waiting for the next `apply`. */
  private selectedId: string | null = null
  /** Empty until mounted: the palette is only readable once a styled canvas exists. */
  private meshColor = ''

  constructor(private readonly options: SceneRendererOptions) {
    // No lights here: they are nodes of the state now, so the viewport shows what the outliner
    // lists — and hiding one actually darkens the scene.
    this.camera.position.set(5, 5, 5)
    this.camera.lookAt(0, 0, 0)
  }

  /** Makes its own canvas: React must never own it — see the engine invariants in CLAUDE.md. */
  mount(host: HTMLElement): void {
    const canvas = document.createElement('canvas')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    // Appended before the palette is read: `getComputedStyle` only inherits the studio tokens
    // once the element is actually in the document.
    host.appendChild(canvas)

    this.applyPalette(canvas)

    const renderer = new WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer = renderer

    this.orbit = new OrbitControls(this.camera, canvas)
    this.orbit.enableDamping = true
    this.orbit.addEventListener('change', this.requestRender)

    const gizmo = new TransformControls(this.camera, canvas)
    // Since r169 the controls are not an Object3D; the helper is what goes into the scene.
    this.scene.add(gizmo.getHelper())
    gizmo.addEventListener('dragging-changed', this.onDraggingChanged)
    gizmo.addEventListener('objectChange', this.requestRender)
    gizmo.addEventListener('mouseUp', this.onGizmoRelease)
    this.gizmo = gizmo

    const viewHelper = new ViewHelper(this.camera, canvas)
    tuneViewHelper(viewHelper)
    this.viewHelper = viewHelper

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('pointerup', this.onPointerUp)

    this.observer = new ResizeObserver(this.onResize)
    this.observer.observe(canvas)
    this.onResize()
  }

  unmount(): void {
    this.dispose()
  }

  apply(state: SceneState): void {
    // A Set rather than a `some` per object: `apply` runs on every state change, selection
    // included, and the quadratic form costs milliseconds well before a scene gets large.
    const alive = new Set<string>()
    for (const node of state.nodes) {
      alive.add(node.id)
      this.syncNode(node)
    }

    let stale: string[] | null = null
    for (const id of this.objects.keys()) if (!alive.has(id)) (stale ??= []).push(id)
    if (stale) for (const id of stale) this.release(id)

    this.selectedId = state.selectedId
    this.attachGizmo()
    this.requestRender()
  }

  setMode(mode: TransformMode): void {
    this.mode = mode
    // `TransformControls` knows only three modes; `select` is ours, and means no gizmo at all.
    if (mode !== 'select') this.gizmo?.setMode(mode)
    this.attachGizmo()
    this.requestRender()
  }

  frameSelection(): void {
    const target = this.gizmo?.object
    if (!target || !this.orbit) return
    this.orbit.target.copy(target.position)
    this.camera.position.copy(target.position).add(new ThreeVector3(4, 4, 4))
    this.orbit.update()
    this.requestRender()
  }

  setMotion(held: Set<MotionId>): void {
    this.held.clear()
    for (const motion of held) this.held.add(motion)
    if (this.flying && this.held.size > 0) this.requestRender()
  }

  dispose(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null

    this.observer?.disconnect()
    this.observer = null

    const canvas = this.renderer?.domElement
    canvas?.removeEventListener('pointerdown', this.onPointerDown)
    canvas?.removeEventListener('contextmenu', this.onContextMenu)
    window.removeEventListener('pointerup', this.onPointerUp)

    this.gizmo?.removeEventListener('dragging-changed', this.onDraggingChanged)
    this.gizmo?.removeEventListener('objectChange', this.requestRender)
    this.gizmo?.removeEventListener('mouseUp', this.onGizmoRelease)
    this.gizmo?.detach()
    this.gizmo?.dispose()
    this.gizmo = null

    this.orbit?.removeEventListener('change', this.requestRender)
    this.orbit?.dispose()
    this.orbit = null

    this.viewHelper?.dispose()
    this.viewHelper = null

    for (const id of [...this.objects.keys()]) this.release(id)

    this.grid?.dispose()
    this.grid = null

    this.renderer?.dispose()
    this.renderer = null

    // The canvas goes with the engine that made it: left behind, the next mount would stack a
    // second one on top of it and the host would keep growing a dead canvas per remount.
    canvas?.remove()
  }

  /** Pulls the studio palette off the canvas, so the viewport follows a theme change with it. */
  private applyPalette(canvas: HTMLCanvasElement): void {
    const background = token(canvas, '--color-viewport')
    // The centre axes take the muted token so they stand out from the grid rather than blend in.
    const axis = token(canvas, '--color-muted')
    const line = token(canvas, '--color-viewport-line')

    this.meshColor = token(canvas, '--color-mesh')
    if (background) this.scene.background = new Color(background)

    if (this.grid) {
      this.scene.remove(this.grid)
      this.grid.dispose()
    }
    this.grid = new GridHelper(GRID_SIZE, GRID_SIZE, axis || undefined, line || undefined)
    this.scene.add(this.grid)
  }

  /**
   * Skips a node whose object is identical to the one already applied. Commands rebuild only the
   * nodes they touch, so a selection — which rebuilds the state but not the array — costs nothing
   * instead of re-deriving a quaternion per object and re-uploading a helper per light.
   */
  private syncNode(node: SceneNode): void {
    if (this.applied.get(node.id) === node) return
    this.applied.set(node.id, node)

    let object = this.objects.get(node.id)
    if (!object) {
      object = node.type === 'mesh' ? this.buildMesh(node) : this.buildLight(node)
      object.name = node.id
      this.objects.set(node.id, object)
      this.scene.add(object)
    }

    const { position, rotation, scale } = node.transform
    object.position.set(position.x, position.y, position.z)
    object.rotation.set(rotation.x, rotation.y, rotation.z)
    object.scale.set(scale.x, scale.y, scale.z)
    object.visible = node.visible

    const helper = this.helpers.get(node.id)
    if (helper) {
      helper.visible = node.visible
      // After the move, never before: the helper draws where the light was until it is told.
      helper.update()
    }
  }

  private buildMesh(node: SceneNode & { type: 'mesh' }): Mesh {
    const material = new MeshStandardMaterial({
      roughness: node.material.roughness,
      metalness: node.material.metalness,
    })
    const color = node.material.color ?? this.meshColor
    if (color) material.color = new Color(color)
    return new Mesh(geometryFor(node.geometry), material)
  }

  private buildLight(node: SceneNode & { type: 'light' }): Light {
    const light = lightFor(node.light)

    // three.js only reads the target's world matrix once the target is in the scene.
    if (light instanceof DirectionalLight || light instanceof SpotLight) {
      this.scene.add(light.target)
    }

    const helper = helperFor(light)
    if (helper) {
      // The helper answers to the light's id, so a click on it selects the light itself.
      helper.name = node.id
      this.helpers.set(node.id, helper)
      this.scene.add(helper)
    }
    return light
  }

  private release(id: string): void {
    this.applied.delete(id)

    const object = this.objects.get(id)
    if (object) {
      this.scene.remove(object)
      if (object instanceof Mesh) {
        object.geometry.dispose()
        disposeMaterial(object)
      }
      if (object instanceof DirectionalLight || object instanceof SpotLight)
        this.scene.remove(object.target)
      this.objects.delete(id)
    }

    const helper = this.helpers.get(id)
    if (helper) {
      this.scene.remove(helper)
      // A forgotten helper leaks a line geometry on every delete.
      helper.dispose()
      this.helpers.delete(id)
    }
  }

  private attachGizmo(): void {
    const id = this.selectedId
    const selected = this.mode !== 'select' && id ? this.objects.get(id) : undefined
    if (selected) this.gizmo?.attach(selected)
    else this.gizmo?.detach()
  }

  private readonly onResize = (): void => {
    const canvas = this.renderer?.domElement
    if (!canvas || !this.renderer) return

    const { clientWidth, clientHeight } = canvas
    if (clientWidth === 0 || clientHeight === 0) return

    this.renderer.setSize(clientWidth, clientHeight, false)
    this.camera.aspect = clientWidth / clientHeight
    this.camera.updateProjectionMatrix()
    this.requestRender()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      this.flying = true
      if (this.orbit) this.orbit.enabled = false
      this.lastTime = performance.now()
      this.requestRender()
      return
    }
    if (event.button !== 0 || this.gizmo?.dragging) return

    const canvas = event.currentTarget
    if (!(canvas instanceof HTMLCanvasElement)) return

    const bounds = canvas.getBoundingClientRect()
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)

    // Helpers are what makes a light clickable, and recursively: it is one of their children
    // that the ray actually meets. Both they and the light carry the node's id.
    const targets = [...this.objects.values(), ...this.helpers.values()]
    const hit = this.raycaster.intersectObjects(targets, true)[0]
    this.options.onSelect(hit ? nodeIdOf(hit.object) : null)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button !== 2) return
    this.flying = false
    this.held.clear()
    if (this.orbit) this.orbit.enabled = true
  }

  // Without this the OS menu opens on the very gesture that starts flying.
  private readonly onContextMenu = (event: Event): void => event.preventDefault()

  private readonly onDraggingChanged = (event: { value: unknown }): void => {
    if (this.orbit) this.orbit.enabled = event.value !== true && !this.flying
  }

  /**
   * The move is reported once the gesture ends, not on every frame of it: one drag must cost one
   * undo, and the mesh already shows the truth while the gizmo holds it.
   */
  private readonly onGizmoRelease = (): void => {
    const target = this.gizmo?.object
    if (!target) return
    this.options.onTransform(target.name, {
      position: { x: target.position.x, y: target.position.y, z: target.position.z },
      rotation: { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z },
      scale: { x: target.scale.x, y: target.scale.y, z: target.scale.z },
    })
  }

  private readonly requestRender = (): void => {
    if (this.frame !== null) return
    this.frame = requestAnimationFrame(this.renderFrame)
  }

  /**
   * On demand, not on a permanent loop: a studio whose viewport burns a frame at rest heats the
   * machine for nothing. The loop keeps going only while something is actually moving.
   */
  private readonly renderFrame = (): void => {
    this.frame = null
    const renderer = this.renderer
    if (!renderer) return

    const now = performance.now()
    const delta = Math.min((now - this.lastTime) / 1000, 0.1)
    this.lastTime = now

    const moving = this.flying && this.held.size > 0
    if (moving) this.fly(delta)

    // `update` reports whether the camera actually moved: it keeps returning true while damping
    // settles, and false once it has — which is what ends the loop instead of running forever.
    const orbit = this.orbit
    const settling = orbit !== null && orbit.enabled && orbit.update()

    renderer.render(this.scene, this.camera)

    /**
     * `autoClear` off for the overlay, as the official editor does before its own helpers.
     * `ViewHelper.render` calls `renderer.render` internally, which clears the colour buffer
     * first — and `gl.clear` ignores the viewport, so it wipes the whole frame. Left on, the
     * trihedron erases the scene it sits on and the viewport stays black.
     */
    renderer.autoClear = false
    try {
      this.viewHelper?.render(renderer)
    } finally {
      // In a `finally`: a throw in the helper would otherwise leave `autoClear` off for good,
      // and every later frame would smear over the last.
      renderer.autoClear = true
    }

    if (moving || settling) this.requestRender()
  }

  private fly(delta: number): void {
    const speed = FLY_SPEED * delta * (this.held.has('boost') ? BOOST_FACTOR : 1)

    this.camera.getWorldDirection(forward)
    right.crossVectors(forward, this.camera.up).normalize()

    step.set(0, 0, 0)
    if (this.held.has('forward')) step.add(forward)
    if (this.held.has('back')) step.sub(forward)
    if (this.held.has('right')) step.add(right)
    if (this.held.has('left')) step.sub(right)
    if (this.held.has('up')) step.y += 1
    if (this.held.has('down')) step.y -= 1
    if (step.lengthSq() === 0) return

    step.normalize().multiplyScalar(speed)
    this.camera.position.add(step)
    this.orbit?.target.add(step)
  }
}

/** Walks up to whoever carries a node id: the ray meets a helper's child, not the helper. */
function nodeIdOf(object: Object3D): string | null {
  let current: Object3D | null = object
  while (current) {
    if (current.name) return current.name
    current = current.parent
  }
  return null
}

function disposeMaterial(mesh: Mesh): void {
  const { material } = mesh
  if (Array.isArray(material)) for (const entry of material) entry.dispose()
  else material.dispose()
}
