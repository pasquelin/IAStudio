import {
  Box3,
  BufferGeometry,
  CameraHelper,
  type AnimationClip,
  DirectionalLight,
  GridHelper,
  Light,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  type Camera,
  SkeletonHelper,
  SpotLight,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  Vector3 as ThreeVector3,
} from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import type { MotionId } from '@shared/domain/shortcut'
import { onPaletteChange } from '../core/palette'
import type { ExportFormat, Transform } from '@shared/domain/scene'
import { DEFAULT_SETTINGS, type Settings } from '@shared/domain/settings'
import type { SelectionMode } from '@/helpers/selection'
import { createEnvironment, type ViewportEnvironment } from '../viewport/environment'
import { createSkyBinding, type SkyBinding } from '../viewport/skyBinding'
import {
  ViewportEngine,
  type ProjectionKind,
  type ViewportCamera,
  type ViewportOutput,
} from '../viewport/ViewportEngine'
import {
  canReceiveShadow,
  type ModelNode,
  type NodeMove,
  type SceneNode,
  type SceneNodeType,
  type SceneState,
  type SpriteNode,
  type TextNode,
} from './sceneState'
import { geometryFor, helperFor, tuneViewHelper, type LightHelper } from './threeFactory'
import {
  applyGeometry,
  applyLight,
  applyMaterial,
  applySprite,
  lightFor,
  standardMaterialOf,
} from './threeSync'
import {
  createMaterialTextures,
  createSpriteTexture,
  type MaterialTextures,
  type SpriteTexture,
} from './materialTextures'
import { createModelTextures, type ModelTextures } from './modelTextures'
import { reportFailure } from '@/services/diagnostics'
import { studioFonts } from '@/services/fonts'
import type { FontLibrary } from '../core/fonts'
import { DEFAULT_FONT, isSameFont } from '@shared/domain/font'
import { textGeometry } from './textGeometry'
import { createGltfSource, type GltfSource } from './gltfSource'
import { SceneAnimations, clipLengthsOf, clipNamesOf, clipsOf, playedClip } from './animation'
import { drivenNodes, poseAt } from './animationEval'
import { timelineClip, type ClipTarget } from './animationClips'
import type { Us } from '@shared/domain/time'
import { nearestBone, type ProjectedBone } from './bonePicking'
import { rigStateOf, type RigState } from './rigState'
import { evenSize, flipInto, frameTimes, type FilmRequest } from './film'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import { createModelCache, instanceOf, type ModelCache, type ModelSource } from './modelCache'
import { applyTransform, carry, placePivot, release, transformOf } from './pivot'
import {
  applyShadowFlags,
  applyShadowQuality,
  fitShadowCamera,
  ownedByAnotherNode,
  resizeShadowMap,
} from './shadows'
import { createPaneMemory, dressForPane } from './paneDress'
import { createPaneMaterials, type PaneMaterials } from './paneMaterials'
import { statsOf, type SceneStats } from './sceneStats'
import {
  applyWireOverlay,
  DEFAULT_PANE_VIEWS,
  showsEdges,
  directionOf,
  framingPlacement,
  plainVector,
  viewPosition,
  type CameraPlacement,
  type PaneView,
} from './sceneView'
import { type DisplayMode, type ViewDirection } from '@shared/domain/scene'
import BvhWorker from './bvh.worker?worker'
import SkinWorker from './skinWeights.worker?worker'
import { applyRig, positionsIn, skinnableMeshesOf } from './rigBuild'
import { createSkinWeights, type SkinWeights } from './skinWeights'
import type { SkinBinding } from './skinVertices'
import type { Rig } from '@shared/domain/rig'
import { createBvhBuilder, type BvhBuilder } from './bvhBuilder'
import { gizmoTargetFor, type TransformMode, type TransformSpace } from './gizmoTarget'
import { exportObjects } from './sceneExport'
import { snapSteps } from './snapSteps'
import {
  createTextureCache,
  loadTexture,
  type TextureCache,
  type TextureSource,
} from './textureCache'

export type { TransformMode, TransformSpace } from './gizmoTarget'

export type SceneRendererOptions = {
  /**
   * What the click asked for, in the shape `Tree` reports it — a click in the void is an empty
   * list. The mode says what the modifier keys meant; a viewport draws no rows, so never a range.
   */
  onSelect: (ids: readonly string[], mode: SelectionMode) => void
  onTransform: (moves: readonly NodeMove[]) => void
  /**
   * What clips a model brought, once its file has landed. React cannot ask the cache: the names
   * live in the file, not in the document, and a panel offering a choice has to know them.
   */
  onClips?: (
    nodeId: string,
    clips: readonly string[],
    lengths: Readonly<Record<string, number>>,
  ) => void
  /**
   * What a model turned out to be once its file landed — bones, humanoid roles, and which of the
   * five states it is in. Same reason as `onClips`: none of it lives in the document.
   */
  onRig?: (nodeId: string, rig: RigState) => void
  /**
   * The bone a click picked while the pose mode is on, or nothing for a click in the void.
   *
   * Apart from `onSelect` because a bone is not a node: it has no id in the document, it is
   * addressed by the pair its channels are addressed by — see `TrackTarget`.
   */
  onSelectBone?: (picked: { nodeId: string; bone: string } | null) => void
  /**
   * A node right-clicked in the viewport, for whoever raises the menu — this side draws none.
   *
   * Only for a right button that went down and came up in the same place with no motion key
   * held: that button flies the camera, and every flight would otherwise end in a menu. A
   * click in the void answers nothing, the fly camera being the gesture that owns the void.
   */
  onContextMenu?: (nodeId: string) => void
  /**
   * What the scene costs, whenever that changes. Counted here because only the engine knows what
   * a model actually brought: the document holds an asset id, not the triangles behind it.
   */
  onStats?: (stats: SceneStats, selected: SceneStats) => void
  /**
   * Where the free camera came to rest, once a drag of it is over.
   *
   * It is what lets a montage look through the view the person is actually working in: a scene
   * with no camera of its own has no other framing anybody chose. Published rather than read,
   * because only the controls know when a gesture ended.
   */
  onView?: (placement: CameraPlacement) => void
  /** Absent builds a real `GLTFLoader`; a test hands a stub, since jsdom parses no GLB. */
  loadModel?: ModelSource
  /** Same, for the sky an environment hangs: jsdom decodes no image either. */
  loadTexture?: TextureSource
  /**
   * When each asset was last written, read off the catalogue by whoever mounts the engine.
   *
   * A port rather than a store read, like everything else here: `engines/` knows no store. It is
   * what makes an edited picture reach the scene — see `refreshTextures`.
   */
  assetVersion?: (assetId: string) => string | undefined
  /** Same again, for the picking trees: jsdom spawns the worker that builds them no more. */
  bvh?: BvhBuilder
  /** And again, for the skinning weights a local rig is bound with. */
  skin?: SkinWeights
  /**
   * How far along binding a model's rig is, 0 to 1. Reported because it is the one operation of
   * this engine that can take a minute — and it is free, so nothing else warns the user it began.
   */
  onRigProgress?: (nodeId: string, progress: number) => void
  /** The typefaces a text is cut from. Shared with the image workspace — see `services/fonts`. */
  fonts?: FontLibrary
}

/**
 * What the viewport is set to. Held by the engine and pushed in by React, like every other
 * piece of state it reflects: these were three constants, and therefore three settings nobody
 * could reach.
 *
 * The settings themselves, not a copy of their shape. Spelled out here, the two drifted in
 * silence: a field added to the settings would have compiled on both sides and simply never
 * reached the viewport. Whether snapping is ON stays out — that is `setSnapping`, per document,
 * not a preference.
 */
type ViewportOptions = Settings['three']

/**
 * How strongly the environment lights the scene. Below one because a scene has lights of its own
 * and shadows to keep readable — the texture preview, which has neither, judges at full strength.
 */
const STUDIO_INTENSITY = 0.4

/** How far the pointer may wander between press and release and still count as a click, in px. */
const CLICK_SLOP = 4

/**
 * Whether a release ends a click rather than a drag. Both buttons ask it: the left one to tell a
 * pick from an orbit, the right one to tell a menu from a flight — and a slop written twice is a
 * slop that stops agreeing the day it learns about pointer type or DPI.
 */
function wasClick(from: { x: number; y: number } | null, event: PointerEvent): boolean {
  return from !== null && Math.hypot(event.clientX - from.x, event.clientY - from.y) <= CLICK_SLOP
}

/** Scratch vectors for the fly loop, which runs every frame while a direction is held. */
const forward = new ThreeVector3()
const right = new ThreeVector3()
const step = new ThreeVector3()

/**
 * three-mesh-bvh reads a `boundsTree` if the mesh has one and falls back to walking triangles if
 * it has none, so patching the prototypes once is safe for every mesh in the studio — the two
 * other 3D spaces included, where no tree is ever built.
 */
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
Mesh.prototype.raycast = acceleratedRaycast

/** Posed on long-lived helpers: a fresh closure each would keep its enclosing scope alive. */
const NOOP = (): void => {}

/** Scratch for projecting a bone, so a click over a rig allocates nothing per bone. */
const BONE_WORLD = new Vector3()

/** Where a normalised view stands when the camera already sits on its target and has no distance. */
const DEFAULT_VIEW_DISTANCE = 8

/**
 * The node types an automatic framing counts — see `frameContents`. Lights and cameras are
 * placed away from what they light or watch, and a group is only ever as big as its children,
 * which are counted on their own.
 */
const FRAMED_NODES: ReadonlySet<SceneNodeType> = new Set<SceneNodeType>([
  'mesh',
  'model',
  'text',
  'sprite',
])

/**
 * How far a side view stands off its target. Distance changes nothing an orthographic camera
 * shows — its frustum does that — but it decides what falls behind the near plane, and a camera
 * standing on the origin clips away the model it is aimed at.
 */
const SIDE_VIEW_DISTANCE = 50

/** What a side view takes in when the scene is empty, and the floor under a tiny one. */
const SIDE_VIEW_HEIGHT = 6

/** Room around what the side views frame, so nothing sits flush against the edge. */
const SIDE_VIEW_MARGIN = 1.4

/**
 * A second of the trihedron's own animation, in the seconds it takes. It turns a whole revolution
 * per second and no side is half of one away, so one step lands on the target exactly.
 */
const HELPER_SETTLES = 1

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
    onPane: (index, camera) => this.dressPane(index, camera),
    // Read back rather than computed here: only the controls know where an orbit ended up.
    onCameraSettled: () => this.options.onView?.(this.viewPlacement()),
    // Only here: the texture and skybox viewports show what they show without any light told to
    // cast, so a depth pass per frame would buy them nothing.
    shadows: true,
  })

  /**
   * Replaced by `configure` before the first frame; these keep the engine usable without it.
   *
   * Copied rather than referenced: `configure` swaps the whole object today, but a field written
   * in place would otherwise reach through into what every window opens on.
   */
  private view: ViewportOptions = { ...DEFAULT_SETTINGS.three }

  private readonly raycaster = new Raycaster()
  private readonly pointer = new Vector2()
  private readonly objects = new Map<string, Object3D>()
  /** A shadow walk stops here: what hangs under a node carries that node's flags, not its parent's. */
  private readonly belongsToAnotherNode = ownedByAnotherNode(this.objects)
  private readonly helpers = new Map<string, LightHelper>()
  /** The texture slots of each mesh, and the references they hold on the cache. */
  private readonly textures = new Map<string, MaterialTextures>()
  /** The same, for the one map a sprite wears. Apart, so each map stays exactly typed. */
  private readonly spriteMaps = new Map<string, SpriteTexture>()
  /** The project's maps put over the ones a model's file carries, per node. See `model-textures`. */
  private readonly modelMaps = new Map<string, ModelTextures>()
  /** Last node applied per id, compared by reference to skip what has not changed. */
  private readonly applied = new Map<string, SceneNode>()
  private readonly textureCache: TextureCache
  private readonly modelCache: ModelCache
  private readonly gltf: GltfSource
  /** The clips of every model on stage. Apart from the nodes: see `animation.ts`. */
  private readonly animations = new SceneAnimations()
  /** One per rigged model, drawn over it. Beside the nodes like the grid — never inside one. */
  private readonly skeletons = new Map<string, SkeletonHelper>()
  private showSkeletons = false
  /**
   * Whether a click picks a BONE rather than a mesh.
   *
   * The two are exclusive on purpose, which is what answers the reason bones were taken off the
   * raycaster: a rig's bones cross every mesh they drive, so offering both at once means a click
   * that lands on whichever the ray happens to meet first.
   */
  private poseMode = false
  /** The bone the gizmo is aimed at while the pose mode is on, and what a release reports. */
  private pickedBone: { nodeId: string; bone: string } | null = null
  /** The tracks of the document, and where the head stands over them. */
  private timeline: AnimationTimeline = EMPTY_TIMELINE
  private playhead = 0
  /** Where each driven bone rested when it arrived, keyed `<nodeId>/<bone>`. See `applyBonePoses`. */
  private readonly boneRests = new Map<string, Transform>()
  private readonly held = new Set<MotionId>()

  private environment: ViewportEnvironment | null = null
  private readonly sky: SkyBinding

  /** What the gizmo holds when more than one node is selected. See `pivot.ts`. */
  private readonly pivot = new Object3D()
  /** Whether the gesture in progress has moved anything at all. A bare click has not. */
  private dragged = false
  /** Where the left button went down, so the release can tell a click from an orbit. */
  private pressed: { x: number; y: number } | null = null
  /**
   * Where the right button went down, or nothing while it is up. It doubles as "the camera is
   * flying", the two being the same fact: the button starts the flight and ends it. A flight
   * that never left the pixel it started on is a click, and raises the node menu instead.
   */
  private flownFrom: { x: number; y: number } | null = null
  /**
   * Whether the camera actually moved while the button was down. The pointer alone cannot say:
   * a flight is driven by the keyboard, so letting go of `W` before the button — the ordinary
   * way to end one — leaves a release that never moved a pixel, and every flight ended in a menu.
   */
  private flew = false

  private gizmo: TransformControls | null = null
  private viewHelper: ViewHelper | null = null
  private grid: GridHelper | null = null
  private mode: TransformMode = 'select'
  private snapping = false
  private space: TransformSpace = 'world'
  /** Held so leaving `select` can re-arm the gizmo without waiting for the next `apply`. */
  private selectedIds: readonly string[] = []
  /** Empty until mounted: the palette is only readable once a styled canvas exists. */
  private meshColor = ''
  /** One mode per pane, main view first. A single-view scene reads index 0 and nothing else. */
  private displays: DisplayMode[] = ['shaded']
  /** Whether the edges are rebuilt as quads. Never real quads — see `applyWireOverlay`. */
  private quadEdges = false
  /** What each view shows. The main one is free until something says otherwise. */
  private paneViews: PaneView[] = [...DEFAULT_PANE_VIEWS]

  /** One line material for every overlay: they all draw the same edges in the same colour. */
  private readonly wireMaterial = new LineBasicMaterial()
  /** The clay, matcap and density materials a view paints with instead of the model's own. */
  private readonly paneMaterials: PaneMaterials = createPaneMaterials()
  /** What each mesh wore, and which lights the material preview put out — see `pane-dress`. */
  private readonly paneMemory = createPaneMemory()
  private readonly bvh: BvhBuilder
  private readonly skin: SkinWeights
  /** The binds still running, so a model that leaves the stage takes its own off the worker. */
  private readonly skinning = new Map<string, AbortController>()
  private readonly fonts: FontLibrary
  private stopPaletteWatch: (() => void) | null = null
  /** Set by `prepareOffscreen`: what stops the backdrop being painted over a montage. */
  private transparent = false

  constructor(private readonly options: SceneRendererOptions) {
    // Injected rather than built here, so a test can drive the whole model path without a
    // decoder: jsdom parses no GLB, exactly as it decodes no image.
    // One cache for the whole scene: ten meshes sharing a map upload it once.
    this.textureCache = createTextureCache(
      options.loadTexture ?? loadTexture,
      (assetId, error) => reportFailure('scene.texture', assetId, error),
      options.assetVersion,
    )
    this.gltf = options.loadModel
      ? { load: options.loadModel, dispose: () => {} }
      : createGltfSource(() => this.viewport.gl)
    this.modelCache = createModelCache(
      this.gltf.load,
      // The node stays in the outliner and draws nothing: a corrupt or compressed GLB is
      // otherwise indistinguishable from one that was never asked for.
      (assetId, error) => reportFailure('scene.model', assetId, error),
    )
    this.bvh = options.bvh ?? createBvhBuilder(() => new BvhWorker())
    this.skin = options.skin ?? createSkinWeights(() => new SkinWorker())
    this.sky = createSkyBinding(this.textureCache, () => this.paintBackground())
    // The studio's own by default: a face parsed for a caption in the image workspace is the
    // same object a text node extrudes, and half a megabyte of glyph tables is worth sharing.
    this.fonts = options.fonts ?? studioFonts

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

    this.buildViewHelper()

    // On move, not only on press: `TransformControls` listens on this canvas too and was added
    // first, so it sees a press before this file does — and would grab with the camera of the
    // view one has just left.
    canvas.addEventListener('pointermove', this.onPointerMove)
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
    this.timeline = state.animation
    // After the transforms are written, never before: a pose is what the tracks ADD to the one
    // the node holds, so it has to be laid over a rest pose that is already up to date.
    //
    // Unconditional: gating it on `state.animation !== this.timeline` would skip the pass after a
    // node was rebuilt under an unchanged timeline, and that node would stand in its rest pose.
    // It costs nothing on a scene with no track, and the loop is over driven nodes, not all.
    this.applyPoses()
    if (this.environment) void this.sky.apply(this.environment, state.environment)
    this.attachGizmo()
    this.reportStats()
    this.viewport.requestRender()
  }

  /**
   * Where the head stands, in seconds. Session state, so it arrives by a call of its own rather
   * than inside the document — playing would otherwise put one undo entry per frame.
   */
  setPlayhead(time: Us): void {
    if (time === this.playhead) return
    this.playhead = time
    this.applyPoses()
    // The clips of every imported model follow the head too, which is what puts them on the band
    // rather than on real time — and what stops a render from writing a frozen character.
    this.animations.seek(time)
    this.viewport.requestRender()
  }

  /**
   * Lays the timeline over the rest poses. Only the nodes it drives are touched, and a scene
   * with no track at all leaves before building anything.
   */
  private applyPoses(): void {
    const timeline = this.timeline
    if (timeline.tracks.length === 0) return

    for (const nodeId of drivenNodes(timeline)) {
      const object = this.objects.get(nodeId)
      const rest = this.applied.get(nodeId)?.transform
      // A node the gizmo is carrying holds a transform relative to the pivot, not to the scene:
      // writing a world pose into it mid-drag would teleport it, exactly as `syncNode` warns.
      if (!object || !rest || object.parent === this.pivot) continue

      applyTransform(object, poseAt(rest, timeline, nodeId, this.playhead))
    }

    this.applyBonePoses(timeline)
  }

  /**
   * The same, for the bones inside a model. Their rest pose is the one the FILE gave them, not
   * one the document holds — a document holds a reference to a model, never its skeleton — so
   * it is read off the bone the first time a track asks for it and kept.
   */
  private applyBonePoses(timeline: AnimationTimeline): void {
    for (const track of timeline.tracks) {
      const bone = track.target.bone
      if (!bone) continue

      const object = this.objects.get(track.target.nodeId)?.getObjectByName(bone)
      if (!object) continue

      const key = `${track.target.nodeId}/${bone}`
      const rest = this.boneRests.get(key) ?? transformOf(object)
      this.boneRests.set(key, rest)

      applyTransform(object, poseAt(rest, timeline, track.target.nodeId, this.playhead, bone))
    }
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

    const { target, position } = framingPlacement(objects, this.view.fieldOfView)
    orbit.target.copy(target)
    this.viewport.camera.position.copy(position)
    orbit.update()
    // Moving an orthographic camera changes nothing of what it shows: without this, `F` recentred
    // the orbit and left the screen exactly as it was.
    this.viewport.refit()
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
   * Four views or one, and where the three added ones stand.
   *
   * The sides are the three a modelling package opens with — down, from the front, from the left
   * — and the main view keeps the corner it was in, gizmo and all. Aimed from here rather than by
   * the viewport: where a camera stands is a question about the scene, and the viewport holds no
   * scene of its own.
   */
  setQuadView(on: boolean): void {
    this.viewport.setLayout(on ? 'quad' : 'single')
    if (on) this.placePanes()
  }

  /**
   * What each view shows: a side, or a camera free to turn.
   *
   * Only a free view orbits. A side view exists BECAUSE it does not turn — a top view one drag
   * away from being an almost-top view answers no question at all — so its rotation is locked
   * while panning and zooming stay: those move where one looks from, never the direction.
   */
  setPaneViews(views: readonly PaneView[]): void {
    this.paneViews = [...views]
    if (this.quadView()) this.placePanes()
  }

  private placePanes(): void {
    const target = this.viewport.orbit?.target ?? this.pivot.position
    this.viewport.setPaneHeight(this.sceneHeight())

    for (const [index, view] of this.paneViews.entries()) {
      this.viewport.setPaneProjection(index, view === 'free' ? 'perspective' : 'orthographic')

      // Read AFTER the projection is set: swapping it hands the pane a different camera object.
      const camera = this.viewport.paneCameras[index]
      const orbit = this.viewport.paneOrbits[index]
      if (orbit) orbit.enableRotate = view === 'free'
      if (!camera || view === 'free') continue

      const { x, y, z } = viewPosition(view, target, SIDE_VIEW_DISTANCE)
      camera.position.set(x, y, z)
      camera.lookAt(target)
      if (orbit) {
        orbit.target.copy(target)
        orbit.update()
      }
    }
    this.viewport.requestRender()
  }

  /**
   * Counts what the scene holds and what is selected, and says so.
   *
   * Called from `apply` and after a model lands: those are the two moments the count can change,
   * and counting per frame would walk every geometry sixty times a second for a number that
   * moves when a document is edited.
   */
  private reportStats(): void {
    const report = this.options.onStats
    if (!report) return

    const selected = this.selectedIds.flatMap(id => this.objects.get(id) ?? [])
    report(statsOf(this.objects.values()), statsOf(selected))
  }

  /** Which view the pointer is over — what a display command acts on. */
  activePane(): number {
    return this.viewport.activePane
  }

  /**
   * The camera one is working through: the view under the pointer, whichever it is.
   *
   * Only the AXIS of a side view is locked. Selecting, dragging a handle and framing are the
   * work itself, and a layout where three quarters can be looked at but not worked in is three
   * quarters of a viewport wasted.
   */
  private cameraInHand(): ViewportCamera {
    return this.viewport.paneCameras[this.viewport.activePane] ?? this.viewport.camera
  }

  /**
   * Hands the gizmo to the view being worked in.
   *
   * `TransformControls` casts its grab ray from the camera it holds, and sizes its handles in
   * that camera's screen space. Left on the main one, a handle dragged in a side view answers to
   * a ray starting somewhere else entirely.
   */
  private aimGizmo(): void {
    const camera = this.cameraInHand()
    if (this.gizmo && this.gizmo.camera !== camera) this.gizmo.camera = camera
  }

  /**
   * How tall the side views have to see to hold what the scene holds, with room around it.
   *
   * The bounds of the objects rather than a constant: a character is two units tall and a set is
   * fifty, and one frustum for both shows one as a dot and the other as a corner.
   */
  private sceneHeight(): number {
    const bounds = new Box3()
    for (const object of this.objects.values()) bounds.expandByObject(object)
    if (bounds.isEmpty()) return SIDE_VIEW_HEIGHT

    const size = bounds.getSize(new ThreeVector3())
    return Math.max(size.x, size.y, size.z, SIDE_VIEW_HEIGHT * 0.25) * SIDE_VIEW_MARGIN
  }

  quadView(): boolean {
    return this.viewport.paneLayout === 'quad'
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
      {
        // The objects wear node ids, which is what picking reads back off a hit. A file wears the
        // names the document gave them.
        nameOf: id => this.applied.get(id)?.name,
        clipsFor: copies => this.bakedClips(copies),
      },
    )
  }

  /**
   * The document's animation as a clip the file carries — baked, because glTF holds one absolute
   * value per node while a track here holds a delta several tracks add up.
   *
   * Read off the COPIES, which still wear node ids at this point: a clip bound to the objects on
   * screen would name nodes the file does not hold.
   */
  private bakedClips(copies: readonly Object3D[]): AnimationClip[] {
    const targets: ClipTarget[] = []
    for (const nodeId of drivenNodes(this.timeline)) {
      const node = this.applied.get(nodeId)
      const object = copies.flatMap(root => root.getObjectByName(nodeId) ?? []).at(0)
      if (!node || !object) continue

      targets.push({
        nodeId,
        object,
        // A bone's rest is the one the FILE gave it, remembered the first time a track asked —
        // never the node's, which would move the whole rig by the node's own placement.
        restOf: bone => (bone ? (this.boneRests.get(`${nodeId}/${bone}`) ?? null) : node.transform),
      })
    }

    const clip = timelineClip(this.timeline, targets)
    return clip ? [clip] : []
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
    // Rebuilt on the camera the viewport now draws with: a projection change swaps that camera
    // for another object entirely, and the trihedron is built around whichever one it was given.
    // Left alone it would show — and, since it became clickable, turn — a camera nothing renders.
    this.buildViewHelper()
    // The gizmo was handed a camera at mount and casts its grab ray from it. Left on the one
    // nothing draws, the ray starts where that camera was frozen: handles keep the screen size
    // they had, a drag off-centre grabs the neighbouring axis, and a miss falls through to the
    // orbit. Rebound rather than rebuilt — unlike the trihedron, its camera is assignable.
    if (this.gizmo) this.gizmo.camera = this.viewport.camera
  }

  /** The trihedron, on the viewport's current camera. Thrown away and remade rather than rebound:
   * the camera it holds is not part of its published surface. */
  private buildViewHelper(): void {
    const canvas = this.viewport.canvas
    if (!canvas) return

    this.viewHelper?.dispose()
    const helper = new ViewHelper(this.viewport.camera, canvas)
    tuneViewHelper(helper)
    this.viewHelper = helper
    this.viewport.requestRender()
  }

  /**
   * Surfaces, edges, or both — one answer PER VIEW, main one first. Session state: nothing of
   * the document moves.
   *
   * The edges are built as soon as any view asks for them and hidden from the views that did
   * not: a `WireframeGeometry` per mesh is its own buffer, and building one set per pane would
   * cost the scene four times its geometry to show the same edges.
   */
  setDisplayModes(modes: readonly DisplayMode[], quads = this.quadEdges): void {
    const same =
      modes.length === this.displays.length &&
      modes.every((mode, index) => mode === this.displays[index])
    if (same && quads === this.quadEdges) return

    this.displays = [...modes]
    this.quadEdges = quads

    const anyEdges = modes.includes('both') || modes.includes('wireframe')
    for (const object of this.objects.values()) {
      applyWireOverlay(object, anyEdges, this.wireMaterial, quads)
    }
    this.viewport.requestRender()
  }

  /** Whether any view is asking for edges at all — what decides if the geometry is built. */
  private needsEdges(): boolean {
    return this.displays.some(mode => showsEdges(mode, this.quadEdges))
  }

  /**
   * How THIS view shows the scene, set while its pass is about to run.
   *
   * A traversal per pane rather than `scene.overrideMaterial`: an override paints everything the
   * renderer draws, gizmo and grid included, and a manipulator drawn as a wireframe is a
   * manipulator nobody can grab. Only the document's own objects are walked — the gizmo, the
   * grid and the trihedron are siblings, never in `objects`.
   */
  private dressPane(index: number, camera: ViewportCamera): void {
    const mode = this.displays[index] ?? this.displays[0] ?? 'shaded'
    dressForPane(
      this.objects.values(),
      mode,
      this.quadEdges,
      this.paneMaterials,
      this.paneMemory,
      camera,
    )
  }

  /**
   * Whether the bones of every rigged model are drawn over it. A rig is what a motion model
   * hands back, and nothing else in the viewport says whether a mesh carries one.
   */
  setSkeletons(shown: boolean): void {
    if (shown === this.showSkeletons) return
    this.showSkeletons = shown

    this.refreshSkeletons()
  }

  /** The one place the rule lives: written three times, one copy was already wrong. */
  private skeletonsVisible(): boolean {
    return this.showSkeletons || this.poseMode
  }

  private refreshSkeletons(): void {
    for (const helper of this.skeletons.values()) helper.visible = this.skeletonsVisible()
    this.viewport.requestRender()
  }

  /**
   * Whether a click picks a bone instead of a mesh. The skeletons are shown while it is on: a
   * mode that picks what nothing draws is a mode nobody can aim.
   */
  setPoseMode(on: boolean): void {
    if (on === this.poseMode) return
    this.poseMode = on

    this.refreshSkeletons()
  }

  /**
   * Every bone on stage, as the screen sees it. Built per click rather than kept: a bone moves
   * with its rig, and a cached projection would name whatever stood there a frame ago.
   */
  private projectedBones(camera: Camera): ProjectedBone[] {
    const projected: ProjectedBone[] = []

    for (const [nodeId, helper] of this.skeletons) {
      for (const bone of helper.bones) {
        if (!bone.name) continue

        bone.getWorldPosition(BONE_WORLD)
        BONE_WORLD.project(camera)
        projected.push({
          nodeId,
          bone: bone.name,
          x: BONE_WORLD.x,
          y: BONE_WORLD.y,
          z: BONE_WORLD.z,
        })
      }
    }

    return projected
  }

  /**
   * A helper is built from the instance and hung beside the nodes, like the grid and the
   * trihedron — never inside the model, where the outliner would list it as part of the scene
   * and a click could pick it.
   */
  /**
   * Weights every mesh of a model against the rig its document holds, then binds them.
   *
   * Off the UI thread and reporting as it goes: half a million vertices against fifty-two bones
   * is twenty-six million distances, and the window has to stay answerable throughout.
   */
  private async skinModel(nodeId: string, holder: Object3D, rig: Rig): Promise<void> {
    const meshes = skinnableMeshesOf(holder)
    if (meshes.length === 0) return

    this.stopSkinning(nodeId)
    const stop = new AbortController()
    this.skinning.set(nodeId, stop)

    const bindings: SkinBinding[] = []
    for (const [index, mesh] of meshes.entries()) {
      const bound = await this.skin.bind(positionsIn(mesh, holder), rig, {
        signal: stop.signal,
        onProgress: progress =>
          this.options.onRigProgress?.(nodeId, (index + progress) / meshes.length),
      })
      // Taken back, or the port let go — either way this model is no longer being skinned.
      if (!bound) return
      bindings.push(bound)
    }

    this.skinning.delete(nodeId)
    // The model may have been released while the weights were out.
    if (this.objects.get(nodeId) !== holder) return

    applyRig(holder, rig, bindings)
    this.options.onRigProgress?.(nodeId, 1)
    this.viewport.requestRender()
  }

  /** Twenty-six million distances are not worth finishing for a model nobody will see again. */
  private stopSkinning(nodeId: string): void {
    this.skinning.get(nodeId)?.abort()
    this.skinning.delete(nodeId)
  }

  private bindSkeleton(nodeId: string, root: Object3D, hasBones: boolean): void {
    this.unbindSkeleton(nodeId)

    if (!hasBones) return

    const helper = new SkeletonHelper(root)
    helper.visible = this.skeletonsVisible()
    // Off the raycaster: the bones of a rig cross every mesh it drives, and a click would land
    // on a line rather than on the model it belongs to.
    helper.raycast = NOOP
    this.skeletons.set(nodeId, helper)
    this.viewport.scene.add(helper)
  }

  private unbindSkeleton(nodeId: string): void {
    const helper = this.skeletons.get(nodeId)
    if (!helper) return

    helper.removeFromParent()
    helper.dispose()
    this.skeletons.delete(nodeId)
  }

  /**
   * Readies this renderer to draw somewhere other than a screen, before it is mounted.
   *
   * Transparency is the point: a scene laid over a montage has to hand back the pixels it
   * painted and nothing behind them, or every clip under it would be hidden by a backdrop.
   */
  prepareOffscreen(output: ViewportOutput): void {
    this.transparent = output.alpha === true
    this.viewport.configureOutput(output)
  }

  /** Where the free camera stands and what it looks at, as plain numbers anything may hold. */
  viewPlacement(): CameraPlacement {
    const camera = this.viewport.perspective
    // The orbit's target when there is one, and a point ahead of the camera otherwise: a
    // viewport with no controls still has a direction, and `lookAt(0,0,0)` would be a lie.
    const target =
      this.viewport.orbit?.target ??
      camera.position.clone().add(camera.getWorldDirection(new ThreeVector3()))

    return { position: plainVector(camera.position), target: plainVector(target) }
  }

  /**
   * Points the free camera at what the scene SHOWS, from a direction of the caller's choosing.
   *
   * Only the nodes that draw something are counted. A lamp stands where it lights FROM, ten
   * units up and to the side of what it lights: counted in the bounding box, a new scene's
   * three default lights make the box ten times the subject, and the subject lands small and
   * off in a corner. That is exactly what an automatic framing must not do.
   *
   * `from` is a direction, never a position — the studio's three-quarter view when nothing is
   * asked for. It is what a montage hands the ANGLE of the 3D tab's own camera through: a
   * working view sits well back, with room around the subject to see the grid, and taken whole
   * it would hand the montage a character a few pixels tall. The angle is a decision somebody
   * made; the distance is this function's, always.
   *
   * The camera is moved directly rather than through the orbit: a viewport drawing into a video
   * frame has no one dragging it, and the orbit's target would only be read on the next drag.
   * It asks for no render of its own, unlike `frameSelection`: its caller draws the very next
   * line, and a frame loop woken per aim would run the viewport's pass forever behind a canvas
   * nobody is looking at.
   *
   * Answers whether it actually framed SOMETHING — false while every model is still a node with
   * no file behind it, which encloses no box at all. That is what lets a caller aim once and
   * stop: re-aiming per frame makes the camera chase a walking character's own bounding box,
   * and the picture breathes with every step.
   */
  frameContents(from?: CameraPlacement): boolean {
    const objects: Object3D[] = []
    for (const [id, object] of this.objects) {
      if (FRAMED_NODES.has(this.applied.get(id)?.type ?? 'group')) objects.push(object)
    }
    if (objects.length === 0) return false

    const bounds = new Box3()
    for (const object of objects) bounds.expandByObject(object)
    // Empty means the files have not landed: `framingPlacement` would fall back to averaging
    // the placements of empty groups, which is a framing of nothing dressed up as one.
    if (bounds.isEmpty()) return false

    const direction = from
      ? new ThreeVector3(
          from.position.x - from.target.x,
          from.position.y - from.target.y,
          from.position.z - from.target.z,
        )
      : undefined

    const { target, position } = framingPlacement(objects, this.view.fieldOfView, direction)
    const camera = this.viewport.perspective
    camera.position.copy(position)
    camera.lookAt(target)
    this.viewport.orbit?.target.copy(target)
    return true
  }

  /**
   * Draws ONE frame, now, through a camera of the scene, and hands back the canvas it landed on.
   *
   * Straight onto the drawing buffer rather than through a render target: the caller wraps that
   * canvas in a `VideoFrame` on the very next line, and a read back through the CPU would cost
   * eight megabytes a frame for pixels the GPU already holds. It follows that the frame must be
   * taken before this task yields — which is what `scene-sink` promises.
   *
   * `null` before the viewport is mounted, which is the whole of what can go wrong here.
   */
  drawFrom(cameraNodeId: string | null, time: Us): HTMLCanvasElement | null {
    const gl = this.viewport.gl
    const canvas = this.viewport.canvas
    if (!gl || !canvas) return null

    const aimed = cameraNodeId ? this.objects.get(cameraNodeId) : null
    const camera = aimed instanceof PerspectiveCamera ? aimed : this.viewport.perspective

    this.setPlayhead(time)

    const restore = this.hideWorkshop()
    camera.aspect = canvas.width / canvas.height
    camera.updateProjectionMatrix()

    try {
      gl.setRenderTarget(null)
      gl.render(this.viewport.scene, camera)
    } finally {
      restore()
    }
    return canvas
  }

  /**
   * Hides everything the workshop draws for the person editing — light helpers, camera
   * frustums, skeletons, the grid — and hands back the call that puts them all back.
   *
   * A render is the scene, not the tools it was built with. A directional light's helper is a
   * line drawn clean across the picture, and it was in every frame of both the film and the
   * montage. Only what was actually visible is restored: a helper already hidden by a setting
   * must not be turned on by a render passing through.
   */
  private hideWorkshop(): () => void {
    const hidden: Object3D[] = []
    const hide = (object: Object3D | null | undefined): void => {
      if (!object?.visible) return
      object.visible = false
      hidden.push(object)
    }

    for (const helper of this.helpers.values()) hide(helper)
    for (const skeleton of this.skeletons.values()) hide(skeleton)
    hide(this.grid)
    for (const object of this.objects.values()) {
      hide(object.children.find(child => child instanceof CameraHelper))
    }

    return () => {
      for (const object of hidden) object.visible = true
    }
  }

  /**
   * Draws the film one frame at a time, from a camera of the scene, and hands each one over
   * already encoded as a PNG.
   *
   * Off screen and at the film's own size, never the viewport's: what is being written has a
   * resolution of its own, and resizing the viewport to match would be visible on screen. The
   * helper the camera wears is hidden for the pass — a render is what the camera sees, not a
   * picture of the camera.
   *
   * `onFrame` is awaited between frames on purpose: it is what carries the bytes to the main
   * process, and running ahead of it would hold a whole film in memory.
   */
  async renderFilm(
    cameraNodeId: string,
    request: FilmRequest,
    onFrame: (index: number, png: Uint8Array) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    const gl = this.viewport.gl
    const camera = this.objects.get(cameraNodeId)
    if (!gl || !(camera instanceof PerspectiveCamera)) throw new Error('no camera to render from')

    const { width, height } = evenSize(request)
    const target = new WebGLRenderTarget(width, height)
    const pixels = new Uint8Array(width * height * 4)
    const surface = new OffscreenCanvas(width, height)
    const context = surface.getContext('2d')
    if (!context) throw new Error('no 2d context to read the frames back through')

    // Hoisted with the pixel buffer: at 1920×1080 an `ImageData` per frame is 8 MB of churn, and
    // a thousand-frame film would hand the collector sixteen gigabytes for nothing.
    const image = context.createImageData(width, height)

    const restore = this.hideWorkshop()

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    const head = this.playhead

    try {
      let index = 0
      for (const time of frameTimes(request.duration, request.fps)) {
        if (signal?.aborted) return

        this.setPlayhead(time)
        gl.setRenderTarget(target)
        gl.render(this.viewport.scene, camera)
        gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)

        flipInto(image.data, pixels, width, height)
        context.putImageData(image, 0, 0)
        const blob = await surface.convertToBlob({ type: 'image/png' })
        index += 1
        await onFrame(index, new Uint8Array(await blob.arrayBuffer()))
      }
    } finally {
      gl.setRenderTarget(null)
      target.dispose()
      restore()
      // Where the head was before the film was asked for: a render is not an edit.
      this.setPlayhead(head)
      this.viewport.requestRender()
    }
  }

  setMotion(held: Set<MotionId>): void {
    this.held.clear()
    for (const motion of held) this.held.add(motion)
    if (this.flying && this.held.size > 0) this.viewport.requestRender()
  }

  /** Whether the right button is down, which is the whole of what flying means here. */
  private get flying(): boolean {
    return this.flownFrom !== null
  }

  dispose(): void {
    this.stopPaletteWatch?.()
    this.stopPaletteWatch = null

    const canvas = this.viewport.canvas
    canvas?.removeEventListener('pointermove', this.onPointerMove)
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
    this.animations.clear()
    for (const id of [...this.skeletons.keys()]) this.unbindSkeleton(id)
    this.textureCache.dispose()
    this.modelCache.dispose()
    this.gltf.dispose()
    this.wireMaterial.dispose()
    this.paneMaterials.dispose()
    this.bvh.dispose()
    this.skin.dispose()

    this.grid?.dispose()
    this.grid = null

    this.viewport.dispose()
  }

  /**
   * The catalogue moved: every slot asks again for what it holds, and reloads the ones whose
   * picture was overwritten since.
   *
   * Nothing at all when no version changed — a binding compares what it holds before it lets go —
   * so this may be called on every write to the shelf, which is exactly what it is for. Without
   * it a texture edited and saved stayed on screen as it was until the engine was rebuilt, since
   * the id a slot points at does not move when ⌘S rewrites the file behind it.
   */
  refreshTextures(): void {
    for (const [id, maps] of this.textures) {
      const node = this.applied.get(id)
      if (node?.type === 'mesh') maps.apply(node.material)
    }
    for (const [id, maps] of this.spriteMaps) {
      const node = this.applied.get(id)
      if (node?.type === 'sprite') maps.apply(node.sprite)
    }
    for (const [id, maps] of this.modelMaps) {
      const node = this.applied.get(id)
      if (node?.type === 'model') maps.apply(node.model.textures)
    }
    // The environment too: a skybox asset is a picture of the project like any other, and the
    // lighting it drives is what would otherwise stay on the image the edit replaced.
    void this.sky.refresh()
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
    // A scene drawn for compositing keeps nothing behind it: a backdrop would hide every clip
    // this one is laid over, and the sky — when there is one — is scenery the user asked for.
    if (this.transparent && !this.sky.showsSky()) {
      this.viewport.scene.background = null
      return
    }
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
      if (this.needsEdges()) this.applyDisplay(object)
    } else {
      // Only what an edit actually changed: rebuilding a geometry or recompiling a shader on
      // every move of the gizmo would cost the drag its frame rate.
      this.syncDescriptors(object, previous, node)
    }

    // Only when they moved: the flags are set per mesh, so a model of a few thousand of them
    // would be walked on every value an inspector drag emits. What a model brings later is
    // flagged where it arrives, in `buildModel`.
    if (previous?.castShadow !== node.castShadow || previous.receiveShadow !== node.receiveShadow) {
      applyShadowFlags(object, node.castShadow, receivesShadow(node), this.belongsToAnotherNode)
    }
    if (node.type === 'light') this.tuneShadow(object)

    // The clips of a model that is already on stage. Skipped for one still loading: `buildModel`
    // binds what the file brought the moment it lands, and applies this reference there.
    if (node.type === 'model' && this.animations.has(node.id)) {
      this.animations.apply(node.id, playedClip(node.model.clips ?? []))
      this.viewport.requestRender()
    }

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
        if (this.needsEdges()) this.applyDisplay(object)
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
      return
    }

    if (node.type === 'model') {
      const before = previous?.type === 'model' ? previous : null
      // Nothing at all until the file has landed: `buildModel` applies what the node holds the
      // moment it builds the maps, and there is no material to write into before that.
      if (before?.model.textures !== node.model.textures) {
        this.modelMaps.get(node.id)?.apply(node.model.textures)
      }
      return
    }

    if (node.type === 'text' && object instanceof Mesh) {
      const before = previous?.type === 'text' ? previous : null
      // Cut again only when the words or their shape moved: a colour change must not re-extrude
      // a caption, which is the one edit here that costs a frame.
      if (before?.text !== node.text) void this.reshapeText(node)

      const material = standardMaterialOf(object)
      if (material && before?.material !== node.material) {
        applyMaterial(material, node.material, this.meshColor)
      }
    }
  }

  private build(node: SceneNode): Object3D {
    if (node.type === 'mesh') return this.buildMesh(node)
    if (node.type === 'light') return this.buildLight(node)
    if (node.type === 'model') return this.buildModel(node)
    if (node.type === 'sprite') return this.buildSprite(node)
    if (node.type === 'text') return this.buildText(node)
    if (node.type === 'camera') return this.buildCamera(node)
    // A group is its transform and nothing else: an empty object others hang from.
    return new Object3D()
  }

  /**
   * A camera of the scene, drawn as the frustum it sees — the helper is what makes it clickable
   * and readable, since a camera itself draws nothing.
   *
   * Hung UNDER the camera rather than beside it, unlike a light's helper: this one has to follow
   * the object it draws through every move, and a camera is aimed far more often than a lamp.
   */
  private buildCamera(node: SceneNode & { type: 'camera' }): Object3D {
    const camera = new PerspectiveCamera(node.camera.fov, 1, node.camera.near, node.camera.far)
    const helper = new CameraHelper(camera)
    // The helper reads the camera's world matrix, which is only right once three has updated it.
    camera.add(helper)
    return camera
  }

  /**
   * Words as a solid. Born with no geometry at all: a face is fetched and parsed long after the
   * frame that asked for it, exactly like a model's file or a mesh's maps.
   */
  private buildText(node: TextNode): Mesh {
    const material = new MeshStandardMaterial()
    applyMaterial(material, node.material, this.meshColor)

    const mesh = new Mesh(new BufferGeometry(), material)
    void this.reshapeText(node)

    return mesh
  }

  /**
   * The letters, cut again from whatever the node now says.
   *
   * A face nothing can produce falls back to one the studio ships rather than leaving the node
   * invisible — the words are what someone typed, and showing them plainly beats showing nothing.
   * That is not a silent swap: the document keeps the family it names, and `fonts` has already
   * written the failure to the log.
   */
  private async reshapeText(node: TextNode): Promise<void> {
    const font =
      (await this.fonts.load(node.text.font)) ??
      (isSameFont(node.text.font, DEFAULT_FONT) ? null : await this.fonts.load(DEFAULT_FONT))

    const object = this.objects.get(node.id)
    // The node may have been edited, retyped or deleted while the face was on its way: what is
    // in the scene now is what decides, never what asked.
    if (!font || !(object instanceof Mesh) || this.applied.get(node.id) !== node) return

    object.geometry.dispose()
    object.geometry = textGeometry(font, node.text)
    // Same reason as a model landing into a wireframe scene: the edges were built from the shape
    // that was there before the face arrived — an empty one at first, the previous words after an
    // edit — and outline a mesh that no longer exists until they are built again.
    if (this.needsEdges()) this.applyDisplay(object)
    this.viewport.requestRender()
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

      // The instance, never the cached source: its materials are shared with every other node
      // built from the same file, and `createModelTextures` is what clones them before writing.
      const maps = createModelTextures(this.textureCache, holder, this.viewport.requestRender, () =>
        reportFailure(
          'scene.texture',
          assetId,
          new Error('this model carries no material a map can be written into'),
        ),
      )
      this.modelMaps.set(node.id, maps)
      if (applied.type === 'model') maps.apply(applied.model.textures)

      // The clips come from the cached SOURCE rather than the clone: `Object3D.copy` does not
      // carry them, and a clip addresses its targets by name — so the source's drive any
      // instance built from it.
      this.animations.add(node.id, holder, clipsOf(source))
      if (applied.type === 'model') {
        this.animations.apply(node.id, playedClip(applied.model.clips ?? []))
      }
      this.options.onClips?.(node.id, clipNamesOf(source), clipLengthsOf(source))

      // The document's own rig, put back on. Its weights are NOT saved with it — they are derived
      // from mesh and rig, like a BVH — so they are worked out again on every load. The skeleton
      // is reported before that finishes: a rig that takes a minute to bind still has bones the
      // inspector can name at once.
      const held = applied.type === 'model' ? applied.model.rig : undefined
      if (held) void this.skinModel(node.id, holder, held)

      // Read once and used twice: whether this model has bones at all is the same question the
      // helper asks, and answering it in two places is how the two came to disagree. The COUNT
      // and not the named ones — an export that stripped joint names still has a rig to draw.
      const rig = rigStateOf(holder, clipsOf(source))
      this.bindSkeleton(node.id, holder, rig.boneCount > 0)
      this.options.onRig?.(node.id, rig)
      // The bones arrive a tick after the sync that laid the timeline over the scene, so a track
      // on one of them would drive nothing at all until the next edit.
      this.applyPoses()

      applyShadowFlags(
        holder,
        applied.castShadow,
        receivesShadow(applied),
        this.belongsToAnotherNode,
      )
      // The count is a count of what is really there: a model's triangles arrive with its file,
      // which is a tick after the `apply` that asked for it.
      this.reportStats()
      // Same reason, same place: what the file brought was not there when the mode was applied,
      // and a model landing into a wireframe scene would be the one thing still drawn shaded.
      if (this.needsEdges()) this.applyDisplay(holder)
      // A dense model is what makes a click cost a frame — measured in `scene-picking.bench.ts`.
      // Off the UI thread, and after the render: the viewport shows the file before the tree.
      this.viewport.requestRender()
      // Reported rather than swallowed, and under a scope of its own: `reportFailure` says a
      // subject once per scope, so sharing `scene.model` would let a tree that failed swallow the
      // message of a load that fails later for the same asset — two failures nothing relates.
      void this.accelerate(holder).catch(error => reportFailure('scene.bvh', assetId, error))
    })

    return holder
  }

  /** Every mesh a model brought, given the tree that makes picking it cheap. */
  private async accelerate(object: Object3D): Promise<void> {
    const meshes: Mesh[] = []
    object.traverse(child => {
      if (child instanceof Mesh) meshes.push(child)
    })

    // Every mesh is asked before any failure is raised. Letting the first one out of the loop
    // would cost the meshes behind it the tree the builder is ready to build them — it recovers
    // from a dead worker, and nothing ever walks a loaded model a second time to ask again.
    const failures: unknown[] = []
    for (const mesh of meshes) {
      try {
        await this.bvh.accelerate(mesh)
      } catch (error) {
        failures.push(error)
      }
    }

    this.viewport.requestRender()
    if (failures.length > 0) throw failures[0]
  }

  private applyDisplay(object: Object3D): void {
    // The mode itself lands per pane, at render time; what an arriving object needs here is its
    // edges, which are geometry rather than a flag.
    applyWireOverlay(object, this.needsEdges(), this.wireMaterial, this.quadEdges)
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
    // Before the instance goes: a mixer holding actions keeps every bone of a released model
    // alive with it.
    this.animations.remove(id)
    this.unbindSkeleton(id)
    this.stopSkinning(id)

    this.applied.delete(id)

    // Before the material goes: the slots have to give their references back, or the cache
    // keeps a 4K map alive for a node that no longer exists.
    for (const maps of [this.textures, this.spriteMaps, this.modelMaps]) {
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

    // A picked bone is what the gizmo holds while the pose mode is on, and it is attached
    // directly: a bone is inside a model's instance, so the pivot has nothing to carry.
    const boneObject = this.pickedBoneObject()
    if (boneObject) {
      if (this.mode === 'select') gizmo.detach()
      else gizmo.attach(boneObject)
      return
    }

    const target = gizmoTargetFor(this.mode, this.space, this.selectedObjects(), object =>
      this.applied.get(object.name),
    )

    if (target.kind === 'none') {
      gizmo.detach()
      return
    }
    if (target.kind === 'object') {
      gizmo.attach(target.object)
      return
    }

    placePivot(this.pivot, target.objects, target.anchor)
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

    const picked = this.pickedBone
    const boneObject = this.pickedBoneObject()
    if (picked && boneObject) {
      const rest = this.boneRestOf(picked.nodeId, picked.bone, boneObject)
      this.options.onTransform([
        { id: picked.nodeId, bone: picked.bone, rest, transform: transformOf(boneObject) },
      ])
      return
    }

    const target = this.gizmo?.object
    if (target) this.options.onTransform([{ id: target.name, transform: transformOf(target) }])
  }

  /** The three object of the bone the pose mode picked, while one is picked and still on stage. */
  private pickedBoneObject(): Object3D | null {
    const picked = this.pickedBone
    if (!picked || !this.poseMode) return null
    return this.objects.get(picked.nodeId)?.getObjectByName(picked.bone) ?? null
  }

  /**
   * Where a bone rested when it arrived, remembered the first time anything asks. It is the pose
   * the FILE gave it, which is what every delta is measured against — see `applyBonePoses`.
   */
  private boneRestOf(nodeId: string, bone: string, object: Object3D): Transform {
    const key = `${nodeId}/${bone}`
    const held = this.boneRests.get(key)
    if (held) return held

    const rest = transformOf(object)
    this.boneRests.set(key, rest)
    return rest
  }

  /** Aims the gizmo at a bone, or lets go of the one it held. */
  setPickedBone(picked: { nodeId: string; bone: string } | null): void {
    this.pickedBone = picked
    this.attachGizmo()
    this.viewport.requestRender()
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

  private readonly onPointerMove = (): void => {
    this.aimGizmo()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      this.flownFrom = { x: event.clientX, y: event.clientY }
      this.flew = false
      const orbit = this.viewport.orbit
      if (orbit) orbit.enabled = false
      // Before the first frame of the flight, or its opening step spans the whole idle time.
      this.viewport.resetClock()
      this.viewport.requestRender()
      return
    }
    if (event.button !== 0 || this.gizmo?.dragging) return
    // The trihedron is drawn over the viewport, so it takes the click before the scene does — and
    // nothing is armed for a selection the click never meant.
    if (this.turnToViewHelper(event)) return
    // Held, not acted on: `OrbitControls` pans on left-drag with any of the three modifiers, and
    // those are the very keys that add to a selection. Picking on release, and only if the
    // pointer never moved, is what stops a recentring gesture from unpicking what it passes over.
    this.pressed = { x: event.clientX, y: event.clientY }
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 2) {
      // A right button that never flew and never moved was a click, not a flight: that is the
      // one gesture left for a menu in this viewport, the button itself being taken by the fly
      // camera.
      const still = !this.flew && this.held.size === 0 && wasClick(this.flownFrom, event)

      this.flownFrom = null
      this.held.clear()
      const orbit = this.viewport.orbit
      if (orbit) orbit.enabled = true

      // Never in pose mode: there a click names a bone, and a bone is not a node the menu could
      // act on.
      if (still && !this.poseMode) {
        const id = this.nodeAt(event)
        if (id) this.options.onContextMenu?.(id)
      }
      return
    }
    if (event.button !== 0) return

    const pressed = this.pressed
    this.pressed = null
    if (!wasClick(pressed, event)) return

    this.aimGizmo()

    // In pose mode a click names a BONE and never a node: the two are exclusive, which is what
    // keeps a rig's bones from stealing every click meant for the mesh they drive.
    if (this.poseMode) {
      const ndc = this.viewport.pointerNdcOf(event)
      if (!ndc) return

      // The camera of the view under the pointer, never the main one — `nodeAt` says why.
      const picked = nearestBone(this.projectedBones(this.cameraInHand()), { x: ndc.x, y: ndc.y })
      this.options.onSelectBone?.(picked ? { nodeId: picked.nodeId, bone: picked.bone } : null)
      return
    }

    // Either modifier adds and removes: a viewport draws no rows, so it has no range to extend.
    const extending = event.shiftKey || event.metaKey || event.ctrlKey
    const id = this.nodeAt(event)
    this.options.onSelect(id ? [id] : [], extending ? 'toggle' : 'replace')
  }

  /** The node the pointer is over, or nothing for a ray that met only the void. */
  private nodeAt(event: PointerEvent): string | null {
    const ndc = this.viewport.pointerNdcOf(event)
    if (!ndc) return null

    this.pointer.set(ndc.x, ndc.y)
    // The camera of the view under the pointer, never the main one: a ray cast from elsewhere
    // meets whatever stands in ITS way, so a click in a side view picked something the pointer
    // was nowhere near — which made every view but the first one inert.
    this.raycaster.setFromCamera(this.pointer, this.cameraInHand())

    // Helpers are what makes a light clickable, and recursively: it is one of their children
    // that the ray actually meets. Both they and the light carry the node's id.
    const targets = [...this.objects.values(), ...this.helpers.values()]
    const hit = this.raycaster.intersectObjects(targets, true)[0]
    return hit ? nodeIdOf(hit.object, name => this.objects.has(name)) : null
  }

  /**
   * The side the trihedron was clicked on, gone to through `viewFrom`. Answers whether the click
   * was its, so the viewport can leave it alone.
   *
   * The helper moves the camera itself, around a centre of its own that `OrbitControls` knows
   * nothing about: left to it, the orbit's target would drift and the first drag afterwards would
   * swing the view somewhere nobody asked for. So its centre is put on the target, its animation
   * is run out in one step — only to learn which side it aimed at — and the move is left to
   * `viewFrom`, which keeps the distance, nudges the poles off axis and tells the controls.
   */
  private turnToViewHelper(event: PointerEvent): boolean {
    const helper = this.viewHelper
    const orbit = this.viewport.orbit
    if (!helper || !orbit) return false

    const camera = this.viewport.camera
    const from = camera.position.clone()
    const facing = camera.quaternion.clone()

    helper.center.copy(orbit.target)
    // The helper reads where the camera stands to work out where it would send it, and one
    // sitting exactly on its target stands nowhere: every side would come back as the same
    // point. Pushed off first, and put back below whatever the click turns out to be.
    if (from.equals(orbit.target)) camera.position.z += DEFAULT_VIEW_DISTANCE

    const hit = helper.handleClick(event)
    if (hit) helper.update(HELPER_SETTLES)
    const direction = hit ? directionOf(camera.position.clone().sub(orbit.target)) : null

    // Put back everything the helper moved. It was only ever asked which side it aimed at; the
    // move itself belongs to `viewFrom`, which reads the distance off the camera it is about to
    // move and tells the controls once it has.
    camera.position.copy(from)
    camera.quaternion.copy(facing)
    if (direction) this.viewFrom(direction)

    return hit
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
    if (moving) {
      // Remembered rather than read back at the release: the keys are let go of first, and the
      // release would then look exactly like a click — see `flew`.
      this.flew = true
      this.fly(delta)
    }
    // Both, never short-circuited: a clip has to keep running while the camera flies over it.
    return this.animations.update(delta) || moving
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

/**
 * Whether a model has to be built again rather than patched.
 *
 * A rig counts as much as an asset: putting one on replaces every mesh by a skinned one and hangs
 * bones under the holder, which is a different object graph and not an edit of this one.
 */
function pointsElsewhere(previous: ModelNode, node: SceneNode): boolean {
  if (node.type !== 'model') return true
  return previous.model.assetId !== node.model.assetId || previous.model.rig !== node.model.rig
}

function disposeMaterial(mesh: Mesh): void {
  const { material } = mesh
  if (Array.isArray(material)) for (const entry of material) entry.dispose()
  else material.dispose()
}
