import {
  BoxGeometry,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3 as ThreeVector3,
  WebGLRenderer,
  type BufferGeometry,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import type { MotionId } from '@shared/domain/shortcut'
import type { SceneObject, SceneState, Transform } from './scene-state'

export type TransformMode = 'translate' | 'rotate' | 'scale'

export type SceneRendererOptions = {
  onSelect: (id: string | null) => void
  onTransform: (id: string, transform: Transform) => void
}

const FLY_SPEED = 4
const BOOST_FACTOR = 3
const GRID_SIZE = 20

function geometryFor(kind: SceneObject['kind']): BufferGeometry {
  if (kind === 'sphere') return new SphereGeometry(0.5, 32, 16)
  if (kind === 'plane') return new PlaneGeometry(1, 1)
  return new BoxGeometry(1, 1, 1)
}

/**
 * The three.js side of a scene. It owns no truth: `apply` reflects a state it never computes,
 * so the whole thing can be thrown away and rebuilt — which is exactly what changing workspace
 * does to it.
 */
export class SceneRenderer {
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(60, 1, 0.1, 1000)
  private readonly grid = new GridHelper(GRID_SIZE, GRID_SIZE, '#34363a', '#2b2d30')
  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly meshes = new Map<string, Mesh>()
  private readonly held = new Set<MotionId>()

  private renderer: WebGLRenderer | null = null
  private orbit: OrbitControls | null = null
  private gizmo: TransformControls | null = null
  private viewHelper: ViewHelper | null = null
  private observer: ResizeObserver | null = null
  private frame: number | null = null
  private flying = false
  private lastTime = 0

  constructor(private readonly options: SceneRendererOptions) {
    this.scene.background = new Color('#191a1c')
    this.scene.add(new HemisphereLight('#ffffff', '#444444', 2))

    const sun = new DirectionalLight('#ffffff', 2)
    sun.position.set(5, 10, 7)
    this.scene.add(sun)
    this.scene.add(this.grid)

    this.camera.position.set(5, 5, 5)
    this.camera.lookAt(0, 0, 0)
  }

  mount(canvas: HTMLCanvasElement): void {
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

    this.viewHelper = new ViewHelper(this.camera, canvas)

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
    for (const object of state.objects) this.syncMesh(object)

    for (const [id, mesh] of this.meshes) {
      if (state.objects.some(object => object.id === id)) continue
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      disposeMaterial(mesh)
      this.meshes.delete(id)
    }

    const selected = state.selectedId ? this.meshes.get(state.selectedId) : undefined
    if (selected) this.gizmo?.attach(selected)
    else this.gizmo?.detach()

    this.requestRender()
  }

  setMode(mode: TransformMode): void {
    this.gizmo?.setMode(mode)
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

    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose()
      disposeMaterial(mesh)
    }
    this.meshes.clear()
    this.grid.dispose()

    this.renderer?.dispose()
    this.renderer = null
  }

  private syncMesh(object: SceneObject): void {
    let mesh = this.meshes.get(object.id)
    if (!mesh) {
      mesh = new Mesh(geometryFor(object.kind), new MeshStandardMaterial({ color: '#8a8f98' }))
      mesh.name = object.id
      this.meshes.set(object.id, mesh)
      this.scene.add(mesh)
    }

    const { position, rotation, scale } = object.transform
    mesh.position.set(position.x, position.y, position.z)
    mesh.rotation.set(rotation.x, rotation.y, rotation.z)
    mesh.scale.set(scale.x, scale.y, scale.z)
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
    const hit = this.raycaster.intersectObjects([...this.meshes.values()], false)[0]
    this.options.onSelect(hit ? hit.object.name : null)
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
    this.viewHelper?.render(renderer)

    if (moving || settling) this.requestRender()
  }

  private fly(delta: number): void {
    const speed = FLY_SPEED * delta * (this.held.has('boost') ? BOOST_FACTOR : 1)

    const forward = new ThreeVector3()
    this.camera.getWorldDirection(forward)
    const right = new ThreeVector3().crossVectors(forward, this.camera.up).normalize()

    const step = new ThreeVector3()
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

function disposeMaterial(mesh: Mesh): void {
  const { material } = mesh
  if (Array.isArray(material)) for (const entry of material) entry.dispose()
  else material.dispose()
}
