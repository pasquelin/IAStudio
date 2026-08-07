import {
  DirectionalLight,
  GridHelper,
  Light,
  Mesh,
  MeshStandardMaterial,
  Raycaster,
  SpotLight,
  TextureLoader,
  Vector2,
  Vector3 as ThreeVector3,
  type Object3D,
} from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import type { MotionId } from '@shared/domain/shortcut'
import { onPaletteChange } from '../core/palette'
import type { Transform } from '@shared/domain/scene'
import { ViewportEngine } from '../viewport/ViewportEngine'
import type { SceneNode, SceneState } from './scene-state'
import { geometryFor, helperFor, tuneViewHelper, type LightHelper } from './three-factory'
import {
  applyGeometry,
  applyLight,
  applyMaterial,
  lightFor,
  standardMaterialOf,
} from './three-sync'
import { createMaterialTextures, type MaterialTextures } from './material-textures'
import { createTextureCache } from './texture-cache'

/** `select` clicks without arming a gizmo — the mode you come back to. */
export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale'

export type SceneRendererOptions = {
  onSelect: (id: string | null) => void
  onTransform: (id: string, transform: Transform) => void
}

/**
 * What the viewport is set to. Held by the engine and pushed in by React, like every other
 * piece of state it reflects: these were three constants, and therefore three settings nobody
 * could reach.
 */
export type ViewportOptions = {
  showGrid: boolean
  gridSize: number
  flySpeed: number
  boostFactor: number
  fieldOfView: number
}

/** Scratch vectors for the fly loop, which runs every frame while a direction is held. */
const forward = new ThreeVector3()
const right = new ThreeVector3()
const step = new ThreeVector3()

/**
 * The three.js side of a scene. It owns no truth: `apply` reflects a state it never computes,
 * so the whole thing can be thrown away and rebuilt — which is exactly what changing workspace
 * does to it.
 *
 * The canvas, the renderer, the camera, the orbit controls and the on-demand loop are not its
 * own: they are the shared `ViewportEngine`, so what this file holds is what makes a scene
 * *editor* — gizmos, selection, the trihedron, the grid and keyboard flight.
 */
export class SceneRenderer {
  private readonly viewport = new ViewportEngine({
    onFrame: delta => this.advance(delta),
    onOverlay: renderer => this.viewHelper?.render(renderer),
  })

  /** Replaced by `configure` before the first frame; these keep the engine usable without it. */
  private view: ViewportOptions = {
    showGrid: true,
    gridSize: 20,
    flySpeed: 4,
    boostFactor: 3,
    fieldOfView: 60,
  }

  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly objects = new Map<string, Object3D>()
  private readonly helpers = new Map<string, LightHelper>()
  /** The texture slots of each mesh, and the references they hold on the cache. */
  private readonly textures = new Map<string, MaterialTextures>()
  /** Last node applied per id, compared by reference to skip what has not changed. */
  private readonly applied = new Map<string, SceneNode>()
  private readonly loader = new TextureLoader()
  // One cache for the whole scene: ten meshes sharing a map upload it once.
  private readonly textureCache = createTextureCache(url => this.loader.loadAsync(url))
  private readonly held = new Set<MotionId>()

  private gizmo: TransformControls | null = null
  private viewHelper: ViewHelper | null = null
  private grid: GridHelper | null = null
  private flying = false
  private mode: TransformMode = 'select'
  /** Held so leaving `select` can re-arm the gizmo without waiting for the next `apply`. */
  private selectedId: string | null = null
  /** Empty until mounted: the palette is only readable once a styled canvas exists. */
  private meshColor = ''
  private stopPaletteWatch: (() => void) | null = null

  constructor(private readonly options: SceneRendererOptions) {
    // No lights here: they are nodes of the state now, so the viewport shows what the outliner
    // lists — and hiding one actually darkens the scene.
    this.viewport.camera.position.set(5, 5, 5)
    this.viewport.camera.lookAt(0, 0, 0)
  }

  mount(host: HTMLElement): void {
    this.viewport.mount(host)

    const canvas = this.viewport.canvas
    const camera = this.viewport.camera
    if (!canvas) return

    this.stopPaletteWatch = onPaletteChange(this.onPaletteChanged)

    this.applyPalette()

    const gizmo = new TransformControls(camera, canvas)
    // Since r169 the controls are not an Object3D; the helper is what goes into the scene.
    this.viewport.scene.add(gizmo.getHelper())
    gizmo.addEventListener('dragging-changed', this.onDraggingChanged)
    gizmo.addEventListener('objectChange', this.viewport.requestRender)
    gizmo.addEventListener('mouseUp', this.onGizmoRelease)
    this.gizmo = gizmo

    const viewHelper = new ViewHelper(camera, canvas)
    tuneViewHelper(viewHelper)
    this.viewHelper = viewHelper

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('pointerup', this.onPointerUp)
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
    this.viewport.requestRender()
  }

  setMode(mode: TransformMode): void {
    this.mode = mode
    // `TransformControls` knows only three modes; `select` is ours, and means no gizmo at all.
    if (mode !== 'select') this.gizmo?.setMode(mode)
    this.attachGizmo()
    this.viewport.requestRender()
  }

  frameSelection(): void {
    const target = this.gizmo?.object
    const orbit = this.viewport.orbit
    if (!target || !orbit) return
    orbit.target.copy(target.position)
    this.viewport.camera.position.copy(target.position).add(new ThreeVector3(4, 4, 4))
    orbit.update()
    this.viewport.requestRender()
  }

  setMotion(held: Set<MotionId>): void {
    this.held.clear()
    for (const motion of held) this.held.add(motion)
    if (this.flying && this.held.size > 0) this.viewport.requestRender()
  }

  dispose(): void {
    this.stopPaletteWatch?.()
    this.stopPaletteWatch = null

    const canvas = this.viewport.canvas
    canvas?.removeEventListener('pointerdown', this.onPointerDown)
    canvas?.removeEventListener('contextmenu', this.onContextMenu)
    window.removeEventListener('pointerup', this.onPointerUp)

    this.gizmo?.removeEventListener('dragging-changed', this.onDraggingChanged)
    this.gizmo?.removeEventListener('objectChange', this.viewport.requestRender)
    this.gizmo?.removeEventListener('mouseUp', this.onGizmoRelease)
    this.gizmo?.detach()
    this.gizmo?.dispose()
    this.gizmo = null

    this.viewHelper?.dispose()
    this.viewHelper = null

    for (const id of [...this.objects.keys()]) this.release(id)
    this.textureCache.dispose()

    this.grid?.dispose()
    this.grid = null

    this.viewport.dispose()
  }

  /**
   * The viewport settings changed. The grid is rebuilt rather than resized — `GridHelper` bakes
   * its geometry at construction — and the camera's projection matrix has to be recomputed by
   * hand, since three.js never reads `fov` back on its own.
   */
  configure(next: ViewportOptions): void {
    const gridMoved = next.showGrid !== this.view.showGrid || next.gridSize !== this.view.gridSize
    const lensMoved = next.fieldOfView !== this.view.fieldOfView

    this.view = next

    if (lensMoved) {
      this.viewport.camera.fov = next.fieldOfView
      this.viewport.camera.updateProjectionMatrix()
    }

    if (gridMoved && this.viewport.canvas) this.applyPalette()
    if (gridMoved || lensMoved) this.viewport.requestRender()
  }

  /**
   * The theme moved. The background, the grid and the axes are rebuilt from the new tokens, but
   * the meshes are not: their materials were built with the previous `--color-mesh`, and
   * `syncNode` compares by reference — every one of them would be skipped. Emptying what has
   * been applied is what makes them repaint, and it costs nothing outside this rare moment.
   */
  private readonly onPaletteChanged = (): void => {
    if (!this.viewport.canvas) return

    this.applyPalette()

    const nodes = [...this.applied.values()]
    this.applied.clear()
    for (const node of nodes) this.syncNode(node)

    this.viewport.requestRender()
  }

  /** Pulls the studio palette off the canvas, so the viewport follows a theme change with it. */
  private applyPalette(): void {
    // The centre axes take the muted token so they stand out from the grid rather than blend in.
    const axis = this.viewport.paletteToken('--color-muted')
    const line = this.viewport.paletteToken('--color-viewport-line')

    this.meshColor = this.viewport.paletteToken('--color-mesh')
    this.viewport.setBackgroundColor(this.viewport.paletteToken('--color-viewport'))

    if (this.grid) {
      this.viewport.scene.remove(this.grid)
      this.grid.dispose()
      // Cleared, not merely disposed: with the grid hidden the reference would survive, and the
      // next theme change would remove and dispose an object that is already gone.
      this.grid = null
    }

    if (!this.view.showGrid) return

    // Divisions equal to the extent, so one square is one metre whatever the size.
    const size = this.view.gridSize
    this.grid = new GridHelper(size, size, axis || undefined, line || undefined)
    this.viewport.scene.add(this.grid)
  }

  /**
   * Skips a node whose object is identical to the one already applied. Commands rebuild only the
   * nodes they touch, so a selection — which rebuilds the state but not the array — costs nothing
   * instead of re-deriving a quaternion per object and re-uploading a helper per light.
   */
  private syncNode(node: SceneNode): void {
    const previous = this.applied.get(node.id)
    if (previous === node) return
    this.applied.set(node.id, node)

    let object = this.objects.get(node.id)
    if (!object) {
      object = node.type === 'mesh' ? this.buildMesh(node) : this.buildLight(node)
      object.name = node.id
      this.objects.set(node.id, object)
      this.viewport.scene.add(object)
    } else {
      // Only what an edit actually changed: rebuilding a geometry or recompiling a shader on
      // every move of the gizmo would cost the drag its frame rate.
      this.syncDescriptors(object, previous, node)
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

  /**
   * What an edit changed on the object already in the scene. Compared against the node last
   * applied rather than against the three.js object: a descriptor is one reference, and an edit
   * that did not touch the material must not walk it field by field.
   */
  private syncDescriptors(
    object: Object3D,
    previous: SceneNode | undefined,
    node: SceneNode,
  ): void {
    if (node.type === 'mesh' && object instanceof Mesh) {
      const before = previous?.type === 'mesh' ? previous : null
      if (before?.geometry !== node.geometry) applyGeometry(object, node.geometry)

      const material = standardMaterialOf(object)
      if (material && before?.material !== node.material) {
        applyMaterial(material, node.material, this.meshColor)
        this.textures.get(node.id)?.apply(node.material)
      }
      return
    }

    if (node.type === 'light' && object instanceof Light) {
      const before = previous?.type === 'light' ? previous : null
      if (before?.light !== node.light) applyLight(object, node.light)
    }
  }

  private buildMesh(node: SceneNode & { type: 'mesh' }): Mesh {
    const material = new MeshStandardMaterial()
    applyMaterial(material, node.material, this.meshColor)

    const mesh = new Mesh(geometryFor(node.geometry), material)
    // A texture arrives long after the frame that asked for it: the render is requested again
    // when it lands, or the viewport would show the mesh untextured until something else moved.
    const textures = createMaterialTextures(
      this.textureCache,
      mesh,
      material,
      this.viewport.requestRender,
    )
    textures.apply(node.material)
    this.textures.set(node.id, textures)

    return mesh
  }

  private buildLight(node: SceneNode & { type: 'light' }): Light {
    const light = lightFor(node.light)

    // three.js only reads the target's world matrix once the target is in the scene.
    if (light instanceof DirectionalLight || light instanceof SpotLight) {
      this.viewport.scene.add(light.target)
    }

    const helper = helperFor(light)
    if (helper) {
      // The helper answers to the light's id, so a click on it selects the light itself.
      helper.name = node.id
      this.helpers.set(node.id, helper)
      this.viewport.scene.add(helper)
    }
    return light
  }

  private release(id: string): void {
    this.applied.delete(id)

    const textures = this.textures.get(id)
    if (textures) {
      // Before the material goes: the slots have to give their references back, or the cache
      // keeps a 4K map alive for a mesh that no longer exists.
      textures.dispose()
      this.textures.delete(id)
    }

    const object = this.objects.get(id)
    if (object) {
      this.viewport.scene.remove(object)
      if (object instanceof Mesh) {
        object.geometry.dispose()
        disposeMaterial(object)
      }
      if (object instanceof DirectionalLight || object instanceof SpotLight)
        this.viewport.scene.remove(object.target)
      this.objects.delete(id)
    }

    const helper = this.helpers.get(id)
    if (helper) {
      this.viewport.scene.remove(helper)
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

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      this.flying = true
      const orbit = this.viewport.orbit
      if (orbit) orbit.enabled = false
      // Before the first frame of the flight, or its opening step spans the whole idle time.
      this.viewport.resetClock()
      this.viewport.requestRender()
      return
    }
    if (event.button !== 0 || this.gizmo?.dragging) return

    const ndc = this.viewport.pointerNdcOf(event)
    if (!ndc) return

    this.pointer.set(ndc.x, ndc.y)
    this.raycaster.setFromCamera(this.pointer, this.viewport.camera)

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
    const orbit = this.viewport.orbit
    if (orbit) orbit.enabled = true
  }

  // Without this the OS menu opens on the very gesture that starts flying.
  private readonly onContextMenu = (event: Event): void => event.preventDefault()

  private readonly onDraggingChanged = (event: { value: unknown }): void => {
    const orbit = this.viewport.orbit
    if (orbit) orbit.enabled = event.value !== true && !this.flying
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

  /** Reports whether the camera is still flying, which is what keeps the loop alive. */
  private advance(delta: number): boolean {
    const moving = this.flying && this.held.size > 0
    if (moving) this.fly(delta)
    return moving
  }

  private fly(delta: number): void {
    const camera = this.viewport.camera
    const boost = this.held.has('boost') ? this.view.boostFactor : 1
    const speed = this.view.flySpeed * delta * boost

    camera.getWorldDirection(forward)
    right.crossVectors(forward, camera.up).normalize()

    step.set(0, 0, 0)
    if (this.held.has('forward')) step.add(forward)
    if (this.held.has('back')) step.sub(forward)
    if (this.held.has('right')) step.add(right)
    if (this.held.has('left')) step.sub(right)
    if (this.held.has('up')) step.y += 1
    if (this.held.has('down')) step.y -= 1
    if (step.lengthSq() === 0) return

    step.normalize().multiplyScalar(speed)
    camera.position.add(step)
    this.viewport.orbit?.target.add(step)
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
