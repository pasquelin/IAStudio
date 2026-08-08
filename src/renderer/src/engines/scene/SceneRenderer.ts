import {
  BufferGeometry,
  DirectionalLight,
  GridHelper,
  Light,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Raycaster,
  SpotLight,
  Sprite,
  SpriteMaterial,
  TextureLoader,
  Vector2,
  Vector3 as ThreeVector3,
} from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import type { MotionId } from '@shared/domain/shortcut'
import { onPaletteChange } from '../core/palette'
import type { ExportFormat, ShadowQuality } from '@shared/domain/scene'
import type { SelectionMode } from '@/helpers/selection'
import { createEnvironment, type ViewportEnvironment } from '../viewport/environment'
import { createSkyBinding, type SkyBinding } from '../viewport/sky-binding'
import { ViewportEngine, type ProjectionKind } from '../viewport/ViewportEngine'
import {
  canReceiveShadow,
  type ModelNode,
  type NodeMove,
  type SceneNode,
  type SceneState,
  type SpriteNode,
} from './scene-state'
import { geometryFor, helperFor, tuneViewHelper, type LightHelper } from './three-factory'
import {
  applyGeometry,
  applyLight,
  applyMaterial,
  applySprite,
  lightFor,
  standardMaterialOf,
} from './three-sync'
import {
  createMaterialTextures,
  createSpriteTexture,
  type MaterialTextures,
  type SpriteTexture,
} from './material-textures'
import { createGltfSource } from './gltf-source'
import { createModelCache, instanceOf, type ModelCache, type ModelSource } from './model-cache'
import { carry, centreOf, placePivot, release, transformOf } from './pivot'
import { applyShadowFlags, applyShadowQuality, fitShadowCamera, resizeShadowMap } from './shadows'
import {
  applyDisplayMode,
  applyWireOverlay,
  viewPosition,
  type DisplayMode,
  type ViewDirection,
} from './scene-view'
import BvhWorker from './bvh.worker?worker'
import { createBvhBuilder, type BvhBuilder } from './bvh-builder'
import { exportObjects } from './scene-export'
import { snapSteps } from './snap-steps'
import { createTextureCache, type TextureCache, type TextureSource } from './texture-cache'

/** `select` clicks without arming a gizmo — the mode you come back to. */
export type TransformMode = 'select' | 'translate' | 'rotate' | 'scale'

/** Which frame the gizmo's handles line up with: the world's axes, or the object's own. */
export type TransformSpace = 'world' | 'local'

export type SceneRendererOptions = {
  /**
   * What the click asked for, in the shape `Tree` reports it — a click in the void is an empty
   * list. The mode says what the modifier keys meant; a viewport draws no rows, so never a range.
   */
  onSelect: (ids: readonly string[], mode: SelectionMode) => void
  onTransform: (moves: readonly NodeMove[]) => void
  /** Absent builds a real `GLTFLoader`; a test hands a stub, since jsdom parses no GLB. */
  loadModel?: ModelSource
  /** Same, for the sky an environment hangs: jsdom decodes no image either. */
  loadTexture?: TextureSource
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
  /** How coarse snapping is when it is on. Whether it is on is `setSnapping`, not a setting. */
  snapTranslate: number
  /** In degrees; converted on the way to the gizmo, which turns in radians. */
  snapRotate: number
  snapScale: number
  /** How soft a shadow edge is. Read by the renderer, once for the whole viewport. */
  shadowQuality: ShadowQuality
  /** Side of the square map each casting light allocates. Doubling it costs four times as much. */
  shadowMapSize: number
}

/**
 * How strongly the environment lights the scene. Below one because a scene has lights of its own
 * and shadows to keep readable — the texture preview, which has neither, judges at full strength.
 */
const STUDIO_INTENSITY = 0.4

/** How far the pointer may wander between press and release and still count as a click, in px. */
const CLICK_SLOP = 4

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
/**
 * three-mesh-bvh reads a `boundsTree` if the mesh has one and falls back to walking triangles if
 * it has none, so patching the prototypes once is safe for every mesh in the studio — the two
 * other 3D spaces included, where no tree is ever built.
 */
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast

/** Where a normalised view stands when the camera already sits on its target and has no distance. */
const DEFAULT_VIEW_DISTANCE = 8

export class SceneRenderer {
  private readonly viewport = new ViewportEngine({
    onFrame: delta => this.advance(delta),
    onOverlay: renderer => this.viewHelper?.render(renderer),
    // Only here: the texture and skybox viewports show what they show without any light told to
    // cast, so a depth pass per frame would buy them nothing.
    shadows: true,
  })

  /** Replaced by `configure` before the first frame; these keep the engine usable without it. */
  private view: ViewportOptions = {
    showGrid: true,
    gridSize: 20,
    flySpeed: 4,
    boostFactor: 3,
    fieldOfView: 60,
    snapTranslate: 0.5,
    snapRotate: 15,
    snapScale: 0.1,
    shadowQuality: 'soft',
    shadowMapSize: 2048,
  }

  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly objects = new Map<string, Object3D>()
  private readonly helpers = new Map<string, LightHelper>()
  /** The texture slots of each mesh, and the references they hold on the cache. */
  private readonly textures = new Map<string, MaterialTextures>()
  /** The same, for the one map a sprite wears. Apart, so each map stays exactly typed. */
  private readonly spriteMaps = new Map<string, SpriteTexture>()
  /** Last node applied per id, compared by reference to skip what has not changed. */
  private readonly applied = new Map<string, SceneNode>()
  private readonly loader = new TextureLoader()
  private readonly textureCache: TextureCache
  private readonly modelCache: ModelCache
  private readonly held = new Set<MotionId>()

  private environment: ViewportEnvironment | null = null
  private readonly sky: SkyBinding

  /** What the gizmo holds when more than one node is selected. See `pivot.ts`. */
  private readonly pivot = new Object3D()
  /** Whether the gesture in progress has moved anything at all. A bare click has not. */
  private dragged = false
  /** Where the left button went down, so the release can tell a click from an orbit. */
  private pressed: { x: number; y: number } | null = null

  private gizmo: TransformControls | null = null
  private viewHelper: ViewHelper | null = null
  private grid: GridHelper | null = null
  private flying = false
  private mode: TransformMode = 'select'
  private snapping = false
  private space: TransformSpace = 'world'
  /** Held so leaving `select` can re-arm the gizmo without waiting for the next `apply`. */
  private selectedIds: readonly string[] = []
  /** Empty until mounted: the palette is only readable once a styled canvas exists. */
  private meshColor = ''
  private display: DisplayMode = 'shaded'

  /** One line material for every overlay: they all draw the same edges in the same colour. */
  private readonly wireMaterial = new LineBasicMaterial()
  private readonly bvh: BvhBuilder = createBvhBuilder(() => new BvhWorker())
  private stopPaletteWatch: (() => void) | null = null

  constructor(private readonly options: SceneRendererOptions) {
    // Injected rather than built here, so a test can drive the whole model path without a
    // decoder: jsdom parses no GLB, exactly as it decodes no image.
    // One cache for the whole scene: ten meshes sharing a map upload it once.
    this.textureCache = createTextureCache(
      options.loadTexture ?? (url => this.loader.loadAsync(url)),
    )
    this.modelCache = createModelCache(options.loadModel ?? createGltfSource())
    this.sky = createSkyBinding(this.textureCache, () => this.paintBackground())

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

    this.viewport.scene.add(this.pivot)

    const gizmo = new TransformControls(camera, canvas)
    // Since r169 the controls are not an Object3D; the helper is what goes into the scene.
    this.viewport.scene.add(gizmo.getHelper())
    gizmo.addEventListener('dragging-changed', this.onDraggingChanged)
    gizmo.addEventListener('objectChange', this.onGizmoChange)
    gizmo.addEventListener('mouseDown', this.onGizmoGrab)
    gizmo.addEventListener('mouseUp', this.onGizmoRelease)
    this.gizmo = gizmo
    // A gizmo is born on defaults, and the engine may already have been told otherwise — every
    // setter no-ops until this point, and `apply` has no reason to come round again.
    if (this.mode !== 'select') gizmo.setMode(this.mode)
    gizmo.setSpace(this.space)
    this.applySnap()
    this.attachGizmo()

    // Lit before anything is added: a scene with no light of its own still shows its materials,
    // exactly as the texture viewport does. `apply` replaces this the moment a document says so.
    const renderer = this.viewport.gl
    if (renderer) {
      this.environment = createEnvironment(
        renderer,
        this.viewport.scene,
        this.viewport.requestRender,
      )
      this.environment.setStudio()
      // Half strength, unlike the texture preview: image-based light comes from everywhere and
      // is occluded by nothing, so at full intensity it fills the very shadows the lights cast.
      this.environment.setIntensity(STUDIO_INTENSITY)
    }

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

    // A second pass, because the first cannot know the order: a child may be synced before the
    // parent it hangs from exists as an object. By here every one of them does.
    for (const node of state.nodes) this.hangFromParent(node)

    this.selectedIds = state.selectedIds
    if (this.environment) void this.sky.apply(this.environment, state.environment)
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

  /** Whether a drag lands on the steps `configure` was given, or wherever it was let go. */
  setSnapping(snapping: boolean): void {
    this.snapping = snapping
    this.applySnap()
  }

  setSpace(space: TransformSpace): void {
    this.space = space
    // Held back mid-drag, like a mode change: `TransformControls` re-aims its interaction plane
    // from `space` every frame, while the start of the gesture was captured on the old one — the
    // object jumps off the axis it was given, and the release writes that jump down.
    if (this.gizmo?.dragging) return

    this.gizmo?.setSpace(space)
    // The pivot carries the frame for a group: re-aimed, or it keeps the last one's orientation.
    this.attachGizmo()
    this.viewport.requestRender()
  }

  /** Frames whatever is selected, gizmo or not: a mode with no gizmo still has a selection. */
  frameSelection(): void {
    const objects = this.selectedObjects()
    const orbit = this.viewport.orbit
    if (objects.length === 0 || !orbit) return

    const centre = centreOf(objects, new ThreeVector3())
    orbit.target.copy(centre)
    this.viewport.camera.position.copy(centre).add(new ThreeVector3(4, 4, 4))
    orbit.update()
    this.viewport.requestRender()
  }

  /** Looks at the scene from one of the six sides, keeping the distance the view already had. */
  viewFrom(direction: ViewDirection): void {
    const orbit = this.viewport.orbit
    if (!orbit) return

    const camera = this.viewport.camera
    const distance = camera.position.distanceTo(orbit.target) || DEFAULT_VIEW_DISTANCE
    const { x, y, z } = viewPosition(direction, orbit.target, distance)

    camera.position.set(x, y, z)
    orbit.update()
    this.viewport.requestRender()
  }

  /**
   * The scene as a file, or only what is selected.
   *
   * Roots only: what hangs from them comes along, and handing the exporter a child as well would
   * write it twice. The grid, the trihedron, the gizmo and the light helpers are siblings of the
   * nodes rather than children, so none of them is reachable from here.
   */
  exportTo(format: ExportFormat, scope: 'scene' | 'selection'): Promise<Uint8Array> {
    const wanted = new Set(scope === 'selection' ? this.selectedIds : this.objects.keys())
    const roots = [...wanted].filter(id => !this.hasExportedAncestor(id, wanted))

    return exportObjects(
      roots.flatMap(id => this.objects.get(id) ?? []),
      format,
    )
  }

  /** A node whose parent is going out too travels with it, and must not be handed over twice. */
  private hasExportedAncestor(id: string, wanted: ReadonlySet<string>): boolean {
    let parentId = this.applied.get(id)?.parentId
    while (parentId) {
      if (wanted.has(parentId)) return true
      parentId = this.applied.get(parentId)?.parentId
    }
    return false
  }

  setProjection(kind: ProjectionKind): void {
    this.viewport.setProjection(kind)
  }

  /** Surfaces, edges, or both. Session state: nothing of the document moves. */
  setDisplayMode(mode: DisplayMode): void {
    if (mode === this.display) return
    this.display = mode

    for (const object of this.objects.values()) {
      applyDisplayMode(object, mode)
      applyWireOverlay(object, mode === 'both', this.wireMaterial)
    }
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
    this.gizmo?.removeEventListener('objectChange', this.onGizmoChange)
    this.gizmo?.removeEventListener('mouseDown', this.onGizmoGrab)
    this.gizmo?.removeEventListener('mouseUp', this.onGizmoRelease)
    this.gizmo?.detach()
    this.gizmo?.dispose()
    this.gizmo = null

    release(this.pivot, this.viewport.scene)
    this.pivot.removeFromParent()

    this.viewHelper?.dispose()
    this.viewHelper = null

    for (const id of [...this.objects.keys()]) this.release(id)
    this.sky.release()
    this.environment?.dispose()
    this.environment = null
    this.textureCache.dispose()
    this.modelCache.dispose()
    this.wireMaterial.dispose()
    this.bvh.dispose()

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
    const shadowsResized = next.shadowMapSize !== this.view.shadowMapSize
    const shadowsMoved = shadowsResized || next.shadowQuality !== this.view.shadowQuality

    this.view = next

    // Through the viewport rather than onto the camera: the orthographic frustum is derived
    // from this very field of view, and has to be resized with it.
    if (lensMoved) this.viewport.setFieldOfView(next.fieldOfView)

    // Unconditional: a step changed while snapping is off has to be waiting when it comes on.
    this.applySnap()

    const gl = this.viewport.gl
    if (gl) applyShadowQuality(gl, next.shadowQuality)
    // Every light, not only the ones built after the change: the map is allocated per light.
    // Every light, not only the ones built after the change: a map is allocated per light, and
    // the frustum of a directional one is sized from the grid the scene is laid out against.
    if (shadowsResized || gridMoved) {
      for (const object of this.objects.values()) this.tuneShadow(object)
    }

    if (gridMoved && this.viewport.canvas) this.applyPalette()
    if (gridMoved || lensMoved || shadowsMoved) this.viewport.requestRender()
  }

  private applySnap(): void {
    const gizmo = this.gizmo
    if (!gizmo) return

    const steps = snapSteps(this.view, this.snapping)
    gizmo.setTranslationSnap(steps.translate)
    gizmo.setRotationSnap(steps.rotate)
    gizmo.setScaleSnap(steps.scale)
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

  /** The backdrop, unless a sky is hanging behind the scene — in which case the sky is it. */
  private paintBackground(): void {
    if (this.sky.showsSky()) return
    this.viewport.setBackgroundColor(this.viewport.paletteToken('--color-viewport'))
  }

  /** Pulls the studio palette off the canvas, so the viewport follows a theme change with it. */
  private applyPalette(): void {
    // The centre axes take the muted token so they stand out from the grid rather than blend in.
    const axis = this.viewport.paletteToken('--color-muted')
    const line = this.viewport.paletteToken('--color-viewport-line')

    this.meshColor = this.viewport.paletteToken('--color-mesh')
    this.paintBackground()

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

    // A model is its file: pointing a node at another asset is a different object, not an edit
    // of this one. Released and rebuilt — patching it would leave the old file on screen and
    // its reference held for good, since `release` only ever knows the asset applied last.
    if (previous?.type === 'model' && (node.type !== 'model' || pointsElsewhere(previous, node))) {
      this.release(node.id)
    }

    this.applied.set(node.id, node)

    let object = this.objects.get(node.id)
    if (!object) {
      object = this.build(node)
      object.name = node.id
      this.objects.set(node.id, object)
      this.viewport.scene.add(object)
      // A node built while a display mode is on has to arrive in it, or it would be the one
      // object in the scene still drawn shaded.
      if (this.display !== 'shaded') this.applyDisplay(object)
    } else {
      // Only what an edit actually changed: rebuilding a geometry or recompiling a shader on
      // every move of the gizmo would cost the drag its frame rate.
      this.syncDescriptors(object, previous, node)
    }

    // Only when they moved: the flags are set per mesh, so a model of a few thousand of them
    // would be walked on every value an inspector drag emits. What a model brings later is
    // flagged where it arrives, in `buildModel`.
    if (previous?.castShadow !== node.castShadow || previous.receiveShadow !== node.receiveShadow) {
      // Not through a group: its children carry their own flags, and traversing would
      // overwrite them without writing anything into their nodes.
      applyShadowFlags(object, node.castShadow, receivesShadow(node), node.type !== 'group')
    }
    if (node.type === 'light') this.tuneShadow(object)

    // A carried object holds a transform relative to the pivot, and the state holds one relative
    // to the scene: writing the second into the first mid-drag teleports it. The release puts
    // the truth back, so an undo during a gesture repaints everything but where things are.
    if (object.parent !== this.pivot) {
      const { position, rotation, scale } = node.transform
      object.position.set(position.x, position.y, position.z)
      object.rotation.set(rotation.x, rotation.y, rotation.z)
      object.scale.set(scale.x, scale.y, scale.z)
    }
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
      if (before?.geometry !== node.geometry) {
        applyGeometry(object, node.geometry)
        // The edges were built from the shape that just went: rebuilt, or they outline a mesh
        // that no longer exists.
        if (this.display === 'both') this.applyDisplay(object)
      }

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
      return
    }

    if (node.type === 'sprite' && object instanceof Sprite) {
      const before = previous?.type === 'sprite' ? previous : null
      if (before?.sprite === node.sprite) return

      applySprite(object.material, node.sprite, this.meshColor)
      this.spriteMaps.get(node.id)?.apply(node.sprite)
    }
  }

  private build(node: SceneNode): Object3D {
    if (node.type === 'mesh') return this.buildMesh(node)
    if (node.type === 'light') return this.buildLight(node)
    if (node.type === 'model') return this.buildModel(node)
    if (node.type === 'sprite') return this.buildSprite(node)
    // A group is its transform and nothing else: an empty object others hang from.
    return new Object3D()
  }

  /**
   * A model arrives long after the frame that asked for it, so what goes into the scene now is
   * an empty holder the file fills in. The alternative — adding nothing until it lands — leaves
   * a node the outliner lists, the gizmo cannot find, and a click cannot select.
   */
  private buildModel(node: ModelNode): Object3D {
    const holder = new Object3D()
    const { assetId } = node.model

    void this.modelCache.acquire(assetId).then(source => {
      // A freshness test and nothing more: `release` owns the reference, as `clear` does in
      // `material-textures`. Letting go here too would drop the count twice, and free a source
      // another node is still cloning.
      if (this.objects.get(node.id) !== holder || !source) return

      holder.add(instanceOf(source))
      // Here rather than in `syncNode`: what arrives lands after the sync that built the holder,
      // and the next one skips an unchanged node — the model would throw nothing until edited.
      const applied = this.applied.get(node.id) ?? node
      applyShadowFlags(holder, applied.castShadow, receivesShadow(applied))
      // Same reason, same place: what the file brought was not there when the mode was applied,
      // and a model landing into a wireframe scene would be the one thing still drawn shaded.
      if (this.display !== 'shaded') this.applyDisplay(holder)
      // A dense model is what makes a click cost a frame — measured in `scene-picking.bench.ts`.
      // Off the UI thread, and after the render: the viewport shows the file before the tree.
      this.viewport.requestRender()
      void this.accelerate(holder)
    })

    return holder
  }

  /** Every mesh a model brought, given the tree that makes picking it cheap. */
  private async accelerate(object: Object3D): Promise<void> {
    const meshes: Mesh[] = []
    object.traverse(child => {
      if (child instanceof Mesh) meshes.push(child)
    })

    for (const mesh of meshes) await this.bvh.accelerate(mesh)
    this.viewport.requestRender()
  }

  private applyDisplay(object: Object3D): void {
    applyDisplayMode(object, this.display)
    applyWireOverlay(object, this.display === 'both', this.wireMaterial)
  }

  /** What a light's shadow is sized against: the settings for the map, the grid for the reach. */
  private tuneShadow(light: Object3D): void {
    resizeShadowMap(light, this.view.shadowMapSize)
    fitShadowCamera(light, this.view.gridSize)
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

  private buildSprite(node: SpriteNode): Sprite {
    const material = new SpriteMaterial()
    applySprite(material, node.sprite, this.meshColor)

    const sprite = new Sprite(material)
    // Like a mesh's maps: the picture arrives long after the frame that asked for it, and the
    // render has to be asked for again when it lands.
    const texture = createSpriteTexture(this.textureCache, material, this.viewport.requestRender)
    texture.apply(node.sprite)
    this.spriteMaps.set(node.id, texture)

    return sprite
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

  /** The object a node hangs from, or the scene for a node that hangs from nothing. */
  private parentObjectOf(id: string): Object3D {
    const parentId = this.applied.get(id)?.parentId
    return (parentId ? this.objects.get(parentId) : null) ?? this.viewport.scene
  }

  /**
   * Puts an object under the one that stands for its parent, or back under the scene.
   *
   * `add` rather than `attach`: the document holds a *local* transform, which `syncNode` has
   * just written — so the object takes its new parent's frame, exactly as the document says.
   * Preserving the world transform instead would need the local one recomputed in the command,
   * which is the only place it could be written down.
   *
   * Skipped mid-drag, where the pivot is the parent that matters.
   */
  private hangFromParent(node: SceneNode): void {
    const object = this.objects.get(node.id)
    if (!object || object.parent === this.pivot) return

    const parent = node.parentId ? this.objects.get(node.parentId) : this.viewport.scene
    // A parent that is not built is not a reason to drop the child: the scene keeps it, and the
    // next sync — where the parent exists — hangs it where it belongs.
    if (!parent || object.parent === parent) return

    parent.add(object)
  }

  private release(id: string): void {
    // Read before `applied` is emptied: the reference the cache holds is keyed by what the node
    // pointed at, and nothing else remembers it.
    const applied = this.applied.get(id)
    if (applied?.type === 'model') this.modelCache.release(applied.model.assetId)

    this.applied.delete(id)

    // Before the material goes: the slots have to give their references back, or the cache
    // keeps a 4K map alive for a node that no longer exists.
    for (const maps of [this.textures, this.spriteMaps]) {
      maps.get(id)?.dispose()
      maps.delete(id)
    }

    const object = this.objects.get(id)
    if (object) {
      // Its own buffer, and a child of the mesh rather than the mesh: nothing else frees it.
      applyWireOverlay(object, false, this.wireMaterial)
      // Not `scene.remove`: mid-drag the object hangs off the pivot, and the scene would not
      // find it to remove.
      object.removeFromParent()
      if (object instanceof Mesh) {
        object.geometry.dispose()
        disposeMaterial(object)
      }
      // A sprite is not a mesh, so the branch above never freed its material. Its geometry is
      // left alone on purpose: three.js shares one quad between every sprite ever built.
      if (object instanceof Sprite) object.material.dispose()
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

  private selectedObjects(): Object3D[] {
    return this.selectedIds.flatMap(id => this.objects.get(id) ?? [])
  }

  private attachGizmo(): void {
    const gizmo = this.gizmo
    if (!gizmo) return
    // Nothing is re-aimed mid-gesture. Detaching would swallow the `mouseUp` that hands the
    // selection back to the scene, and re-centring the pivot while it carries that selection
    // would drag it to the origin — a mode key pressed during a drag must not move anything.
    if (gizmo.dragging) return

    const objects = this.mode === 'select' ? [] : this.selectedObjects()
    const [first] = objects
    if (!first) {
      gizmo.detach()
      return
    }
    // One node attaches straight to its object: routing a single move through the pivot would
    // round-trip its transform through two matrices for nothing.
    if (objects.length === 1) {
      gizmo.attach(first)
      return
    }

    // The anchor is the last node picked, and in the local frame it is what the handles line up
    // with — a group has no orientation of its own to offer.
    placePivot(this.pivot, objects, this.space === 'local' ? objects.at(-1) : undefined)
    gizmo.attach(this.pivot)
  }

  private readonly onGizmoGrab = (): void => {
    this.dragged = false
    if (this.gizmo?.object !== this.pivot) return
    carry(this.pivot, this.selectedObjects(), this.viewport.scene)
  }

  private readonly onGizmoChange = (): void => {
    this.dragged = true
    this.viewport.requestRender()
  }

  /**
   * The move is reported once the gesture ends, not on every frame of it: one drag must cost one
   * undo, and the meshes already show the truth while the gizmo holds them.
   */
  private readonly onGizmoRelease = (): void => {
    const moves = release(this.pivot, this.viewport.scene, id => this.parentObjectOf(id))
    // What a key pressed mid-drag asked for, applied now that the gesture is over.
    this.gizmo?.setSpace(this.space)

    // A click that armed an axis without moving it still round-tripped every carried node
    // through a matrix decomposition, which does not always give the same Euler back — and a
    // negative scale never does. Nothing is reported; the objects are put back from the state.
    if (!this.dragged) {
      if (moves) this.resync(moves)
      return
    }

    if (moves) {
      this.options.onTransform(moves)
      return
    }

    const target = this.gizmo?.object
    if (target) this.options.onTransform([{ id: target.name, transform: transformOf(target) }])
  }

  /** Redraws nodes from what was last applied, undoing what a gesture moved without meaning to. */
  private resync(moves: readonly NodeMove[]): void {
    for (const move of moves) {
      const node = this.applied.get(move.id)
      if (!node) continue
      this.applied.delete(move.id)
      this.syncNode(node)
    }
    this.viewport.requestRender()
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
    // Held, not acted on: `OrbitControls` pans on left-drag with any of the three modifiers, and
    // those are the very keys that add to a selection. Picking on release, and only if the
    // pointer never moved, is what stops a recentring gesture from unpicking what it passes over.
    this.pressed = { x: event.clientX, y: event.clientY }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 2) {
      this.flying = false
      this.held.clear()
      const orbit = this.viewport.orbit
      if (orbit) orbit.enabled = true
      return
    }
    if (event.button !== 0) return

    const pressed = this.pressed
    this.pressed = null
    if (!pressed || Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > CLICK_SLOP)
      return

    const ndc = this.viewport.pointerNdcOf(event)
    if (!ndc) return

    this.pointer.set(ndc.x, ndc.y)
    this.raycaster.setFromCamera(this.pointer, this.viewport.camera)

    // Helpers are what makes a light clickable, and recursively: it is one of their children
    // that the ray actually meets. Both they and the light carry the node's id.
    const targets = [...this.objects.values(), ...this.helpers.values()]
    const hit = this.raycaster.intersectObjects(targets, true)[0]
    const id = hit ? nodeIdOf(hit.object, name => this.objects.has(name)) : null
    // Either modifier adds and removes: a viewport draws no rows, so it has no range to extend.
    const extending = event.shiftKey || event.metaKey || event.ctrlKey
    this.options.onSelect(id ? [id] : [], extending ? 'toggle' : 'replace')
  }

  // Without this the OS menu opens on the very gesture that starts flying.
  private readonly onContextMenu = (event: Event): void => event.preventDefault()

  private readonly onDraggingChanged = (event: { value: unknown }): void => {
    const orbit = this.viewport.orbit
    if (orbit) orbit.enabled = event.value !== true && !this.flying
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

/**
 * Walks up to the object that stands for a node: the ray meets a helper's child, or one of the
 * hundred meshes a GLB brought — and `GLTFLoader` names every one of them, so a name alone
 * proves nothing. Only an id the engine put there counts, or a click on an imported model would
 * select something the scene has never heard of.
 */
export function nodeIdOf(object: Object3D, isNode: (name: string) => boolean): string | null {
  let current: Object3D | null = object
  while (current) {
    if (current.name && isNode(current.name)) return current.name
    current = current.parent
  }
  return null
}

/** A light catches nothing: the flag exists on every node, but only two kinds answer to it. */
function receivesShadow(node: SceneNode): boolean {
  return canReceiveShadow(node) && node.receiveShadow
}

function pointsElsewhere(previous: ModelNode, node: SceneNode): boolean {
  return node.type === 'model' && previous.model.assetId !== node.model.assetId
}

function disposeMaterial(mesh: Mesh): void {
  const { material } = mesh
  if (Array.isArray(material)) for (const entry of material) entry.dispose()
  else material.dispose()
}
