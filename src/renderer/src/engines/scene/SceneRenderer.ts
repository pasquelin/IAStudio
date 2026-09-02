import {
  Box3,
  BufferGeometry,
  CameraHelper,
  Color,
  type AnimationClip,
  DirectionalLight,
  GridHelper,
  type Intersection,
  Light,
  LineBasicMaterial,
  Matrix3,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Raycaster,
  type Camera,
  SkeletonHelper,
  SkinnedMesh,
  SpotLight,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  Vector3 as ThreeVector3,
} from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { ViewHelper } from 'three/addons/helpers/ViewHelper.js'
import type { MotionId } from '@shared/domain/shortcut'
import { anglesFromDirection, type SphericalAngles } from '@shared/domain/angles'
import { aimAlong, DEFAULT_LOOK, turnBy } from '../viewport/lookAround'
import { clampFlySpeed, speedAfterWheel } from './flySpeed'
import { notchesOf, PIVOT_AHEAD } from '../viewport/dolly'
import { onPaletteChange } from '../core/palette'
import {
  DEFAULT_WORLD,
  type ClipLane,
  type ExportFormat,
  type HelperVisibility,
  type LightDescriptor,
  wornMaterials,
  type ModelDress,
  type EnvironmentRef,
  type ModelDressRef,
  type SceneWorld,
  type Transform,
  showsAid,
} from '@shared/domain/scene'
import { createGroundPlane } from './groundPlane'
import { applyFog, applyToneMapping } from './worldBinding'
import { createViewportAids } from './viewportAids'
import { drawsNode, isolating, NOTHING_ISOLATED, type Isolation } from './isolation'
import { pixelRatioFor, shadowMapSizeFor } from './viewportQuality'
import { DEFAULT_SETTINGS, type Settings } from '@shared/domain/settings'
import type { SelectionMode } from '@/helpers/selection'
import { aspectLoan } from '../viewport/aspectLoan'
import { createEnvironment, type ViewportEnvironment } from '../viewport/environment'
import { screenScale } from '../viewport/screenScale'
import { createSkyBinding, type SkyBinding } from '../viewport/skyBinding'
import {
  ViewportEngine,
  type DrawRequest,
  type ProjectionKind,
  type ViewportCamera,
  type ViewportOutput,
} from '../viewport/ViewportEngine'
import type { PaneRect } from '../viewport/panes'
import {
  canReceiveShadow,
  carriesMaterial,
  type ModelNode,
  type NodeMove,
  type SceneNode,
  type SceneNodeType,
  type SceneState,
  type SpriteNode,
  type CarvedNode,
  type MeshNode,
  type TextNode,
} from './sceneState'
import type { Vector3 as PlainVector3 } from '@shared/domain/scene'
import { SCENE_SUBJECT_ID } from '@shared/domain/animation'
import { createAnimatedStacks } from './animatedStack'
import type { CameraMotion, CameraShot, CameraTarget } from '@shared/domain/animation'
import { postOf, stackDraws, type PostStack } from '@shared/domain/postProcessing'
import { curveOf, PATH_SAMPLES, segmentAt } from './cameraPath'
import { spotOnRay } from './railSpot'
import { clampUnit, progressAt } from './cameraMotion'
import { railsInUse, shotCameras, shotOfCameraAt } from './cameraShots'
import {
  buildPath,
  cameraBody,
  helperFor,
  knobIndexOf,
  knobName,
  PATH_CURVE_NAME,
  tuneViewHelper,
  type LightHelper,
} from './threeFactory'
import { applyLightBody, lightBody } from './lightBodies'
import { MARKER_NAME } from './markerPaint'
import { aimLightMarker, holdMarkerSize } from './markerPose'
import {
  applyCamera,
  wearGeometry,
  applyLight,
  applyMaterial,
  applyNegative,
  applyPath,
  applySprite,
  lightFor,
  showPathKnobs,
  standardMaterialOf,
} from './threeSync'
import {
  createMaterialTextures,
  createSpriteTexture,
  type MaterialTextures,
  type SpriteTexture,
} from './materialTextures'
import type { EnvironmentDress } from '@shared/domain/skybox'
import { createModelTextures, type ModelTextures } from './modelTextures'
import { createSkySun, type SkySun } from './skySun'
import { reportFailure } from '@/services/diagnostics'
import { studioFonts } from '@/services/fonts'
import type { FontLibrary } from '../core/fonts'
import { DEFAULT_FONT, isSameFont } from '@shared/domain/font'
import { textGeometry } from './textGeometry'
import { createGltfSource, type GltfSource } from './gltfSource'
import {
  SceneAnimations,
  clipLengthsOf,
  clipNamesOf,
  clipsOf,
  foreignClipsOf,
  type ForeignClip,
} from './animation'
import { createRefCache, type RefCache } from '../core/refCache'
import { drivenNodes, lensAt, poseAt, postAt } from './animationEval'
import { timelineClip, type ClipTarget } from './animationClips'
import { SECOND, type Us } from '@shared/domain/time'
import { nearestProjected, type Projected, type ProjectedBone } from './bonePicking'
import { rigStateOf, type RigState } from './rigState'
import { evenSize, frameTimes, type FilmRequest } from './film'
import { encodeFilmFrameOffThread } from './filmEncodePort'
import { PostComposer } from '../postfx/PostComposer'
import { loadLutTexture } from '../postfx/lutSource'
import { captureSize, type CaptureQuality } from '@shared/domain/sceneCapture'
import { EMPTY_TIMELINE, type AnimationTimeline } from '@shared/domain/animation'
import {
  createModelCache,
  disposeTree,
  instanceOf,
  type ModelCache,
  type ModelSource,
} from './modelCache'
import { applyTransform, carry, placePivot, release, transformOf } from './pivot'
import {
  applyShadowFlags,
  applyShadowQuality,
  applyShadows,
  fitShadowCamera,
  needsShadowFrustum,
  ownedByAnotherNode,
  resizeShadowMap,
} from './shadows'
import { createPaneMemory, dressForPane, forgetDress } from './paneDress'
import { createPaneMaterials, type PaneMaterials } from './paneMaterials'
import { EMPTY_STATS, statsOf, type SceneStats } from './sceneStats'
import {
  applyWireOverlay,
  DEFAULT_PANE_VIEWS,
  showsEdges,
  directionOf,
  framingPlacement,
  isCameraView,
  plainVector,
  viewPosition,
  type CameraPlacement,
  type PaneView,
  type PreviewWatch,
} from './sceneView'
import { type DisplayMode, type ViewDirection } from '@shared/domain/scene'
import BvhWorker from './bvh.worker?worker'
import CsgWorker from '../csg/csg.worker?worker'
import SkinWorker from './skinWeights.worker?worker'
import RetargetWorker from './retarget.worker?worker'
import { createRetarget, retargetFitOf, type Retarget, type RetargetFit } from './retarget'
import { applyRig, positionsIn, skinnableMeshesOf } from './rigBuild'
import { createIkBinding, ikSpecsOf, type IkBinding } from './ik'
import { createBoneJoints, type BoneJoints } from './boneJoints'
import { createSkinWeights, type SkinWeights } from './skinWeights'
import type { SkinBinding } from './skinVertices'
import type { Rig } from '@shared/domain/rig'
import type { HumanoidRole } from '@shared/domain/humanoid'
import { skeletonSignatureOf, type SkeletonProfile } from '@shared/domain/skeletonProfile'
import { createBvhBuilder, type BvhBuilder } from './bvhBuilder'
import { createCsgEvaluator, type CsgEvaluator } from '../csg/csgEvaluator'
import { createGeometryCache, type GeometryCache } from './geometryCache'
import { createBatchedGroups } from './batching'
import './bvhPatches'
import { unhang, type InstancedGroups } from './grouping'
import { createInstancedGroups, keepsItsGroup } from './instancing'
import { uncutGeometry } from '../csg/uncutGeometry'
import { isCarvable, isNegative } from '../csg/carve'
import { gizmoTargetFor, type TransformMode, type TransformSpace } from './gizmoTarget'
import { exportObjects } from './sceneExport'
import { NOTHING_SNAPPED, type Snapping } from '@shared/domain/snap'
import { gizmoSizeFor, heldRadius, screenFactor } from './gizmoSize'
import { heldBy, surfaceLift, surfaceRayFrom, surfaceTurn } from './surfaceSnap'
import { snapSteps } from './snapSteps'
import {
  createTextureCache,
  loadTexture,
  type TextureCache,
  type TextureSource,
} from './textureCache'

export type { TransformMode, TransformSpace } from './gizmoTarget'

export type GroupingStrategy = 'instanced' | 'batched'

export type SceneRendererOptions = {
  /**
   * What the click asked for, in the shape `Tree` reports it — a click in the void is an empty
   * list. The mode says what the modifier keys meant; a viewport draws no rows, so never a range.
   */
  onSelect: (ids: readonly string[], mode: SelectionMode) => void
  onTransform: (moves: readonly NodeMove[]) => void
  /**
   * The editor's own furniture — trihedron, camera bodies and frustums, light helpers, rails.
   * `false` draws none of it: a window that PLAYS a scene shows the game, and the tools it was
   * built with are the studio talking over it.
   */
  chrome?: boolean
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
   * How many MATERIALS a model's file carries — its slots. Same reason as `onClips`: the count
   * lives in the file, and a panel drawing one row per slot has no other way to know it.
   */
  onMaterials?: (nodeId: string, count: number) => void
  /**
   * How well a clip from elsewhere fits this character, once both skeletons are in hand. Only
   * the engine ever holds the two at once, so nothing else could work it out.
   */
  onClipFit?: (nodeId: string, clipKey: string, fit: RetargetFit) => void
  /**
   * What a model turned out to be once its file landed — bones, humanoid roles, and which of the
   * five states it is in. Same reason as `onClips`: none of it lives in the document.
   */
  onRig?: (nodeId: string, rig: RigState) => void
  /**
   * What a skeleton of that signature means, worked out from a document's own rig. Kept by the
   * project rather than here: this port dies with the viewport, and the mapping outlives it.
   */
  onProfile?: (profile: SkeletonProfile) => void
  /** The mappings the project already knows, applied before anything is read. */
  profiles?: readonly SkeletonProfile[]
  /**
   * The bone a click picked while the pose mode is on, or nothing for a click in the void.
   *
   * Apart from `onSelect` because a bone is not a node: it has no id in the document, it is
   * addressed by the pair its channels are addressed by — see `TrackTarget`.
   */
  onSelectBone?: (picked: { nodeId: string; bone: string } | null) => void
  /**
   * A control point of a rail was picked, or let go of. Apart from `onSelect` for the same
   * reason a bone is: a point has no id in the document, and no row in the tree.
   */
  onSelectPathPoint?: (picked: { nodeId: string; index: number } | null) => void
  /** Where a picked control point was dragged to, in the frame of the rail that holds it. */
  onPathPoint?: (nodeId: string, index: number, point: PlainVector3) => void
  /** A point is to be posed on that rail, right after the stretch of it that was clicked. */
  onAddPathPoint?: (nodeId: string, index: number) => void
  /** A point is to be posed at the END of that rail, where the click landed in its own frame. */
  onAppendPathPoint?: (nodeId: string, point: PlainVector3) => void
  /** A control point was right-clicked, for whoever raises its menu — this side draws none. */
  onPathPointMenu?: (nodeId: string, index: number) => void
  /**
   * A camera of the scene was moved by orbiting the pane locked onto it — an EDIT of the
   * document, unlike moving the view, and reported once per gesture rather than per frame.
   */
  onCameraMoved?: (nodeId: string, transform: Transform) => void
  /**
   * A node right-clicked in the viewport, for whoever raises the menu — this side draws none.
   *
   * Only for a right button that went down and came up in the same place with no motion key
   * held: that button flies the camera, and every flight would otherwise end in a menu.
   *
   * `null` for a click that hit nothing — the void offers what a scene can RECEIVE, where a node
   * offers what can be done to it.
   */
  onContextMenu?: (nodeId: string | null) => void
  /**
   * What the scene costs, whenever that changes. Counted here because only the engine knows what
   * a model actually brought: the document holds an asset id, not the triangles behind it.
   */
  onStats?: (stats: SceneStats, selected: SceneStats) => void
  /** The navigation mode is over — by Escape, by a lost capture, or by the caller's own call. */
  onNavigatingChange?: (navigating: boolean) => void
  /** What the wheel left the flying speed at, so a panel can show the figure it is flying at. */
  onFlySpeedChange?: (speed: number) => void
  /**
   * Where the free camera came to rest, once a drag of it is over.
   *
   * It is what lets a montage look through the view the person is actually working in: a scene
   * with no camera of its own has no other framing anybody chose. Published rather than read,
   * because only the controls know when a gesture ended.
   */
  onView?: (placement: CameraPlacement) => void
  /**
   * Which of the four views the pointer settled in. Published rather than asked for: a panel that
   * read it during its own render was never told when the answer moved, and wrote a display mode
   * into the pane the hand had already left.
   */
  onPane?: (pane: number) => void
  /**
   * How repeated shapes are drawn in fewer calls. `instanced` — the default — opens one
   * `InstancedMesh` per shape and material, split into regions; `batched` opens one `BatchedMesh`
   * per material. Measured on this Mac, 2026-09-02, the lot costs MORE CPU on every scene: its
   * per-instance cull and sort run once per pass, 10.4 ms against 3.1 a frame on 10 000 bodies.
   */
  grouping?: GroupingStrategy
  /** Absent builds a real `GLTFLoader`; a test hands a stub, since jsdom parses no GLB. */
  loadModel?: ModelSource
  /** Same, for a file read for its animation alone — which may be an FBX. See `GltfSource`. */
  loadAnimation?: ModelSource
  /** And again, for replaying a shipped animation on a character's own skeleton. */
  retarget?: Retarget
  /** Same, for the sky an environment hangs: jsdom decodes no image either. */
  loadTexture?: TextureSource
  /**
   * When each asset was last written, read off the catalogue by whoever mounts the engine.
   *
   * A port rather than a store read, like everything else here: `engines/` knows no store. It is
   * what makes an edited picture reach the scene — see `refreshTextures`.
   */
  assetVersion?: (assetId: string) => string | undefined
  /** What an open editor is drawing of an asset, ahead of its file — see `livePreviews`. */
  livePreview?: (assetId: string) => ImageBitmap | null
  /**
   * What a model's DRESS is worth to one of its material slots, resolved when the scene is read.
   *
   * Synchronous, like `assetVersion`: the window answers from the open tab or from the copy it
   * read off disk (`materialSources`), and asks for the file when it holds neither. Absent
   * leaves every model on the maps its own file carries — a workspace with no documents, and
   * every test.
   */
  wornDress?: (dress: ModelDressRef, slot: number) => ModelDress | null
  /**
   * What the ENVIRONMENT this scene names is worth to it. Synchronous, like `wornDress`: the
   * window answers from the open tab or from the copy read off disk. Absent, the studio lights it.
   */
  environmentDress?: (environment: EnvironmentRef) => EnvironmentDress | null
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

/** How far a camera's frustum is OUTLINED, in metres. Never how far that camera sees. */
const FRUSTUM_REACH = 2

/**
 * Whether a release ends a click rather than a drag. Both buttons ask it: the left one to tell a
 * pick from an orbit, the right one to tell a menu from a flight — and a slop written twice is a
 * slop that stops agreeing the day it learns about pointer type or DPI.
 */
function wasClick(from: { x: number; y: number } | null, event: PointerEvent): boolean {
  return from !== null && Math.hypot(event.clientX - from.x, event.clientY - from.y) <= CLICK_SLOP
}

/** Where a shot's target stands and where its rail puts it: a camera driven per frame allocates
 * nothing. */
const aimed = new ThreeVector3()
const railed = new ThreeVector3()

/** Scratch vectors for the fly loop, which runs every frame while a direction is held. */
const forward = new ThreeVector3()
const right = new ThreeVector3()
const step = new ThreeVector3()
const flightGaze = new ThreeVector3()

/** Posed on long-lived helpers: a fresh closure each would keep its enclosing scope alive. */
const NOOP = (): void => {}

/** Scratch for projecting a bone, so a click over a rig allocates nothing per bone. */
const BONE_WORLD = new Vector3()

/** Scratch for placing a rail or one of its knobs, so a click over one allocates nothing. */
const RAIL_SPOT = new Vector3()

/** Scratch for the two the fallback plane of a click needs: what it passes through, and its way. */
const RAIL_ANCHOR = new Vector3()
const RAIL_FACING = new Vector3()

/** Where the surface snap looks, and what turns a face's own normal into the world's. */
const DOWNWARD = new Vector3(0, -1, 0)
const SURFACE_NORMAL = new Matrix3()

/** A raycaster that sees what the camera does not — the layer `instancing.ts` hides meshes on. */
function withEveryLayer(raycaster: Raycaster): Raycaster {
  raycaster.layers.enableAll()
  return raycaster
}

/**
 * A pick that may widen the ray's tolerance, with both thresholds put back whatever it does.
 *
 * The raycaster is shared by every pick of the engine: a throw that left `Line.threshold` at
 * another value would silently take away the one thing a light is clickable BY, its helper's
 * lines, and nothing would go red.
 */
function withHeldFuzz<T>(raycaster: Raycaster, pick: () => T): T {
  const { Line, Points } = raycaster.params
  const lines = Line.threshold
  const points = Points.threshold

  try {
    return pick()
  } finally {
    Line.threshold = lines
    Points.threshold = points
  }
}

/**
 * Whether a hit is scenery a DOCUMENT point may be written onto: not a rail of the studio, not a
 * workshop marker, and nothing hanging under something hidden.
 *
 * Walked up the ancestors rather than filtered at the roots, because `intersectObjects` recurses
 * and each of the three reappears through a parent that passed: a rail inside a group is reached
 * THROUGH the group — its knobs are 14 cm spheres, which no line threshold keeps out — a camera's
 * body and a lamp's bulb hang under nodes of their own, and three never reads `visible`.
 */
function isScenery(object: Object3D, isRail: (nodeId: string) => boolean): boolean {
  for (let node: Object3D | null = object; node; node = node.parent) {
    if (!node.visible || node.name === MARKER_NAME || isRail(node.name)) return false
  }

  return true
}

/** How wide a rail's line is grabbed, as a share of the visible height: about six pixels. */
const LINE_GRAB = 1 / 150

/** A control point, as the screen sees it. */
type ProjectedKnob = Projected & { nodeId: string; index: number }

/** What the panel asks the engine to show in the corner — see `setCameraPreview`. */
export type CameraPreviewRequest = {
  cameraNodeId: string
  /** The inside of the DOM frame, in CSS pixels, measured rather than worked out. */
  rect: PaneRect
  /** Grown to the whole view. Told, never measured — the rect is two pixels short of it. */
  full: boolean
}

/**
 * How near the pointer must fall to grab a knob, in normalised device units — the knob covers
 * `KNOB_SHARE` of the height, which is 2 in this space, and a little over that is what a hand
 * needs. Far tighter than a bone's reach: knobs stand apart, where a rig's bones crowd.
 */
const KNOB_REACH = 0.025

/** Where a normalised view stands when the camera already sits on its target and has no distance. */
const DEFAULT_VIEW_DISTANCE = 8

/**
 * How far under zero the reference grid sits. Small enough to read as the ground plane, wide
 * enough that no depth buffer confuses the two.
 */
const GRID_SINKAGE = 0.02

/**
 * The node types an automatic framing counts — see `frameContents`. Lights and cameras are
 * placed away from what they light or watch, and a group is only ever as big as its children,
 * which are counted on their own.
 */
const UNFRAMED_NODES: ReadonlySet<SceneNodeType> = new Set<SceneNodeType>([
  'light',
  'camera',
  'group',
  'path',
])

/** Spelled as what is LEFT OUT: a node kind added to the union is framed by default, where a
 * whitelist would have quietly stopped framing it. */
const isFramed = (type: SceneNodeType): boolean => !UNFRAMED_NODES.has(type)

/** An empty box for an empty set, which is how a caller tells "nothing yet" from "nothing there". */
function boundsOf(objects: Iterable<Object3D>): Box3 {
  const bounds = new Box3()
  for (const object of objects) bounds.expandByObject(object)
  return bounds
}

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
    // Before `TransformControls` reads the same event — see `onPaneArmed`, which says why the
    // viewport owns this call rather than a listener of this file.
    onPaneArmed: event => this.onPointerAim(event),
    // A preview shows what the camera FILMS: the same pass the film and the montage take.
    onInset: () => this.hideWorkshop(),
    // Every surface — the panes, the preview, the film — reaches ONE composer through here, so
    // an effect cannot differ between the editor and the render. See § 26 of the specification.
    onDraw: request => this.compose(request),
    // Read back rather than computed here: only the controls know where an orbit ended up.
    onCameraSettled: pane => this.reportCameraSettled(pane),
    // The nodes alone, and the helpers on purpose: a lamp's glyph is a place one looks AT, never
    // a surface one lands the pivot on.
    pickTargets: () => [...this.objects.values()],
    onWheel: event => this.spendWheelOnSpeed(event),
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

  /**
   * Both raycasters read EVERY layer, the camera's and the one instancing moves meshes to: a
   * repeated shape is drawn by one instance and picked on its own mesh — see `instancing.ts`.
   */
  private readonly raycaster = withEveryLayer(new Raycaster())
  /**
   * The surface snap's own, never the shared one: that one's `Line` and `Points` thresholds are
   * widened by whoever picked last, and a downward ray would then meet a rail before the floor.
   */
  private readonly surfaceRay = withEveryLayer(new Raycaster())
  private readonly surfaceBox = new Box3()
  private readonly surfaceFrom = new Vector3()
  /** The slope the ray met, in world space. Scratch: it is measured once per frame of a drag. */
  private readonly surfaceNormal = new Vector3()
  /** Refilled rather than rebuilt, for the same reason — see `surfaceRoots`. */
  private readonly surfaceScope: Object3D[] = []
  /** What the pivot wore when the drag began. A turn composed onto its own result drifts. */
  private readonly surfaceHeld = new Quaternion()
  /** Scratch for capping the handles to what they hold, so a frame allocates nothing. */
  private readonly gizmoBox = new Box3()
  private readonly gizmoSpan = new Vector3()
  private readonly gizmoEye = new Vector3()
  private readonly gizmoSpot = new Vector3()
  private readonly pointer = new Vector2()
  private readonly objects = new Map<string, Object3D>()
  /** A shadow walk stops here: what hangs under a node carries that node's flags, not its parent's. */
  private readonly belongsToAnotherNode = ownedByAnotherNode(this.objects)
  private readonly helpers = new Map<string, LightHelper>()
  /** The frustum drawn under each camera of the scene — what makes one clickable. */
  private readonly frustums = new Map<string, CameraHelper>()
  /**
   * The body a camera and a lamp are DRAWN as, by node. Kept the way the helpers are, and for the
   * same two reasons: a render hides all of them at once, and finding them by walking each node's
   * children would be a scan per frame.
   */
  private readonly markers = new Map<string, Object3D>()
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
  /** The cameras the shots named last pass, so one they let go of can be put back where it was. */
  private railedCameras = new Set<string>()
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
  /** The control point of a rail the gizmo holds. Never a node — see `setPickedPathPoint`. */
  private pickedPathPoint: { nodeId: string; index: number } | null = null
  /** The tracks of the document, and where the head stands over them. */
  private timeline: AnimationTimeline = EMPTY_TIMELINE

  /** Built at mount, when there is a renderer to build passes with. */
  private post: PostComposer | null = null

  /**
   * The temporary comparison — hold to see the frame without its composition.
   *
   * Session state, never the document: § 2 asks for a look at what is underneath, not for an edit
   * that ⌘Z would have to take back. The stored `enabled` of a stack is the other switch, and it
   * IS an edit.
   */
  private bypassed = false
  /** Per subject, the stack `postAt` answered and everything it was answered FROM. */
  private readonly animated = createAnimatedStacks(postAt)
  private playhead = 0

  /** The frame of the preview loop, so switching block or stopping cancels the one running. */
  private previewFrame = 0

  /** The pose a preview stands still at, which nothing else writes again. See `holdPreview`. */
  private heldPreview: PreviewWatch | null = null
  /** Where each driven bone rested when it arrived, keyed `<nodeId>/<bone>`. See `applyBonePoses`. */
  private readonly boneRests = new Map<string, Transform>()
  private readonly held = new Set<MotionId>()

  private environment: ViewportEnvironment | null = null
  private readonly sky: SkyBinding
  /** What lights the document and hangs behind it, as last applied. See `applyWorld`. */
  private world: SceneWorld = DEFAULT_WORLD
  /** The document's own ground. Beside the nodes like the grid, and never one of them. */
  private readonly ground = createGroundPlane()
  /** The sun the sky it names describes. A node of the scene, so it is born with the renderer. */
  private readonly sun: SkySun = createSkySun(this.viewport.scene)
  /** What the scene was last lit ON, so a pass that changes nothing costs nothing. */
  private lit: { dress: EnvironmentDress | null; intensity: number; rotation: number } | null = null
  /** Boxes, origins and normals. Hung beside the nodes for the reason the ground is not. */
  private readonly aids = createViewportAids()
  /** What the VIEWPORT hides, which is never what the document hides — see `isolation.ts`. */
  private isolation: Isolation = NOTHING_ISOLATED

  /** What the gizmo holds when more than one node is selected. See `pivot.ts`. */
  private readonly pivot = new Object3D()
  /** Whether the gesture in progress has moved anything at all. A bare click has not. */
  private dragged = false
  /** Where the left button went down, so the release can tell a click from an orbit. */
  private pressed: { x: number; y: number } | null = null
  /**
   * Where the button that flies went down, or nothing while none is held. A flight that never
   * left the pixel it started on is a click: the right button raises the node menu, the left
   * one picks.
   */
  private flownFrom: { x: number; y: number } | null = null
  /**
   * Which button armed the flight, and so whether one is under way at all. Either arms it —
   * the left one keeps orbiting and picking exactly as before, it only GAINS the keys.
   */
  private flownWith: number | null = null
  /**
   * Whether the camera actually moved while the button was down. The pointer alone cannot say:
   * a flight is driven by the keyboard, so letting go of `W` before the button — the ordinary
   * way to end one — leaves a release that never moved a pixel, and every flight ended in a menu.
   */
  private flew = false
  /** Armed persistent navigation. `flownWith` stays null throughout: that one records a BUTTON. */
  private navigating = false
  /** Whether the capture was actually granted. A refused mode must not move anybody's pivot. */
  private captured = false
  /** Where the head looks while the pointer is captured. Read off the camera when the mode opens. */
  private look: SphericalAngles = DEFAULT_LOOK
  /** What the wheel left this session at. `configure` drops it, so an edited preference wins. */
  private sessionFlySpeed: number | null = null

  private gizmo: TransformControls | null = null
  /**
   * The rectangle handed to the gizmo, rewritten in place: this is set on every pointer move, and
   * `activePaneRegion` writes into a rect of its own for the same reason.
   */
  private readonly gizmoRegion = new Vector4()
  private viewHelper: ViewHelper | null = null
  private grid: GridHelper | null = null
  /**
   * Two things move separately and are read by different passes, which is why they are two flags
   * and not one: WHAT the scene holds, which the counters read, and WHERE it stands, which the
   * shadow reach reads. A pose displaces without adding; hiding a mesh subtracts without moving.
   */
  private contentChanged = true
  private placementChanged = true
  /**
   * Read by the grouping, which is NOT behind the same switch as the counters: turning the
   * statistics off gives back a walk, it must never change what the GPU is asked to draw.
   */
  private groupingStale = true
  /** Nodes that only MOVED since the last grouping — their slots are still theirs. */
  private readonly movedNodes = new Set<string>()
  /**
   * The box the shadow frusta are cut from, held across passes. A move only ever GROWS it; it is
   * dropped when the content changes, which is the one thing that can make it shrink.
   */
  private shadowBounds: Box3 | null = null
  /**
   * Whether the parent pass has anything to walk. Only content can change where a node hangs —
   * `keepsItsGroup` reads `parentId`, so a node that merely MOVED kept the parent it had.
   */
  private hangAll = true
  /** What the model costs, held between the passes that cannot have changed it. */
  private modelStats: SceneStats = EMPTY_STATS
  private mode: TransformMode = 'select'
  private snapping: Snapping = NOTHING_SNAPPED
  private space: TransformSpace = 'world'
  /** Held so leaving `select` can re-arm the gizmo without waiting for the next `apply`. */
  private selectedIds: readonly string[] = []
  /** The nodes as the document orders them — what an export lists them by, see `exportTo`. */
  private documentOrder: readonly SceneNode[] = []
  /** Empty until mounted: the palette is only readable once a styled canvas exists. */
  private meshColor = ''
  /** What a camera body and a bulb's cap are FILLED with, read off the palette beside `meshColor`. */
  private markerColor = ''
  /** And what outlines them: the edges are what carry the shape where no lamp lights it. */
  private markerEdge = ''
  /** What a shape marked as a TOOL is painted in — see `applyNegative`. */
  private negativeColor = ''
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
  private readonly csg: CsgEvaluator
  /** One shape per distinct descriptor, lent to every node wearing it. */
  private readonly shapes: GeometryCache = createGeometryCache()
  private readonly instances: InstancedGroups
  /** Nodes whose cut is out. Holds which side owes the cache its reference. */
  private readonly cutting = new Set<string>()
  private readonly skin: SkinWeights
  private readonly retarget: Retarget
  /**
   * Which foreign clips a node holds a reference on, by key, and where each was read from. A
   * block plays nothing until its clip lands, and every `apply` would otherwise load again.
   */
  private readonly bundled = new Map<string, Map<string, string>>()
  /**
   * One read per animation FILE, however many characters play it — two dancers are one parse.
   *
   * Kept while a block still names it rather than freed after the retarget: what costs is the
   * read, and the second character to be given the same walk is exactly the case this closes.
   */
  private readonly clipSources: RefCache<Object3D>
  /** The binds still running, so a model that leaves the stage takes its own off the worker. */
  private readonly skinning = new Map<string, AbortController>()
  /** One solver per model that reaches for something. Absent is the common case and costs nothing. */
  private readonly iks = new Map<string, IkBinding>()
  /** The joints of each drawn skeleton, refreshed with the pose. Beside the helper they double. */
  private readonly joints = new Map<string, BoneJoints>()
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
      options.livePreview,
    )
    this.gltf = options.loadModel
      ? {
          load: options.loadModel,
          // A test that hands one stub reads animations off it too, exactly as a `.glb` holding
          // both would.
          loadAnimation: options.loadAnimation ?? options.loadModel,
          dispose: () => {},
        }
      : createGltfSource(() => this.viewport.gl)
    this.modelCache = createModelCache(
      this.gltf.load,
      // The node stays in the outliner and draws nothing: a corrupt or compressed GLB is
      // otherwise indistinguishable from one that was never asked for.
      (assetId, error) => reportFailure('scene.model', assetId, error),
    )
    this.clipSources = createRefCache({
      load: url => this.gltf.loadAnimation(url),
      free: disposeTree,
      // Under a scope of its own: a failing animation must not swallow what a failing model says.
      onFailure: (url, error) => reportFailure('scene.animation', url, error),
    })
    this.bvh = options.bvh ?? createBvhBuilder(() => new BvhWorker())
    this.instances = (options.grouping === 'batched' ? createBatchedGroups : createInstancedGroups)(
      this.viewport.scene,
      mesh =>
        // What the document dresses it in, never what a view left on it: an instance born during
        // a solid pass would wear the stand-in for good.
        this.paneMemory.materials.get(mesh) ?? mesh.material,
    )
    this.csg = createCsgEvaluator({
      spawn: () => new CsgWorker(),
      // The key as subject, so two solids that both fail are two lines rather than one: the node
      // keeps drawing its raw brushes, and a silent second failure would look like a success.
      onFailure: (key, error) => reportFailure('scene.carved', key, error),
    })
    this.skin = options.skin ?? createSkinWeights(() => new SkinWorker())
    this.retarget = options.retarget ?? createRetarget(() => new RetargetWorker())
    // Before any file lands: a skeleton this project has already been taught is recognised on
    // the first model that carries it, in a document that never saw the correction.
    for (const profile of options.profiles ?? []) this.retarget.remember(profile)
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
    // Beside the nodes, like the grid — but unlike the grid it stays in every film pass: it is
    // part of what the document IS, not of the workshop it is built in.
    this.viewport.scene.add(this.ground.object)
    this.viewport.scene.add(this.aids.object)
    this.applyGround()

    const gizmo = new TransformControls(camera, canvas)
    // Since r169 the controls are not an Object3D; the helper is what goes into the scene.
    this.viewport.scene.add(gizmo.getHelper())
    // `onPointerDown` hovers and THEN grabs, so the axis is decided inside the very call that
    // uses the plane. This fires synchronously on that decision, which is the only moment left
    // to turn the plane before it is read.
    gizmo.addEventListener('axis-changed', this.onGizmoAxisChanged)
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
    this.applyGizmoSize()
    this.attachGizmo()

    // Lit before anything is added: a scene with no light of its own still shows its materials,
    // exactly as the texture viewport does. `apply` replaces this the moment a document says so.
    const renderer = this.viewport.gl
    if (renderer) {
      this.post = new PostComposer(renderer, {
        loadLut: assetId => loadLutTexture(assetId, this.textureCache.versionOf(assetId)),
        lutStamp: assetId => this.textureCache.versionOf(assetId),
        // A grade that finished loading changes the picture, and nothing else would ask for the
        // frame that shows it: the loop is asleep by then.
        onReady: () => this.redraw(),
      })
      this.environment = createEnvironment(renderer, this.viewport.scene, () => this.redraw())
      this.environment.setStudio()
      // Half strength, unlike the texture preview: image-based light comes from everywhere and
      // is occluded by nothing, so at full intensity it fills the very shadows the lights cast.
      this.environment.setIntensity(STUDIO_INTENSITY)
      // A document applied before the viewport had a renderer lit none of this: it opened on the
      // procedural studio whatever sky it names. `SkyboxRenderer.mount` replays its own the same way.
      this.lit = null
      this.applyEnvironment(this.world)
    }

    this.buildViewHelper()

    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('contextmenu', this.onContextMenu)
    window.addEventListener('pointerup', this.onPointerUp)
  }

  unmount(): void {
    this.dispose()
  }

  apply(state: SceneState): void {
    // Before the nodes, not after: whether a block travels is decided against what the band
    // already drives, and a model built in this very pass has to read the timeline that arrived
    // with it rather than the previous one.
    this.timeline = state.animation
    this.animations.setTimeline(state.animation)
    this.sweepCompositions(state)
    this.documentOrder = state.nodes

    // The identity test sits HERE rather than only inside `syncNode`: on a pass where nothing
    // changed it is the whole of the work, and a call per node cost 4,6 ms on 50 000.
    for (const node of state.nodes) {
      if (this.applied.get(node.id) !== node) this.syncNode(node)
    }

    // The set of live ids is built only when one can be missing. `applied` holds every node the
    // last pass knew, so it outgrows the state exactly when a node left it — and building that
    // set of 50 000 strings on every pass was most of what `apply` spent outside its sub-passes.
    if (this.applied.size !== state.nodes.length) {
      const alive = new Set<string>()
      for (const node of state.nodes) alive.add(node.id)
      let stale: string[] | null = null
      for (const id of this.objects.keys()) if (!alive.has(id)) (stale ??= []).push(id)
      if (stale) for (const id of stale) this.release(id)
    }

    // A second pass, because the first cannot know the order: a child may be synced before the
    // parent it hangs from exists as an object. By here every one of them does.
    //
    // Walked only when the content moved: a pass where nothing but transforms changed cannot
    // have moved a node under another parent, and walking all of them cost 9,7 ms on 50 000.
    if (this.hangAll) {
      for (const node of state.nodes) this.hangFromParent(node)
      this.hangAll = false
    }
    this.poseMarkers(state.nodes)

    this.selectedIds = state.selectedIds
    // After the transforms are written, never before: a pose is what the tracks ADD to the one
    // the node holds, so it has to be laid over a rest pose that is already up to date.
    //
    // Unconditional: gating it on `state.animation !== this.timeline` would skip the pass after a
    // node was rebuilt under an unchanged timeline, and that node would stand in its rest pose.
    // It costs nothing on a scene with no track, and the loop is over driven nodes, not all.
    this.applyPoses()
    // After every node is placed and posed: the reach is measured off where things actually
    // stand, and a set that grew by one block re-cuts the frustum of every light at once.
    this.tuneShadowsIfMoved()
    this.applyCameraShots()
    this.showAidsForSelection()
    // After the transforms and the poses: a box is read off where an object actually stands.
    this.refreshAids()
    this.applyWorld(state.world)
    this.attachGizmo()
    // Before the counters and after every placement: the instance matrices are copied from the
    // world matrices, which nothing past here moves.
    this.regroupInstances()
    this.reportStats()
    this.redraw()
  }

  /**
   * The working aids — a camera's frustum, a light's helper, a rail's knobs — shown on what is
   * SELECTED and on nothing else.
   *
   * A directional light draws a line clear across the scene and a frustum reaches its camera's
   * `far`: three lamps and two cameras already cross the whole viewport, which is what made a
   * scene unreadable. Selected, a frustum is still drawn SHORT — a thousand metres of outline
   * says nothing a couple of metres does not, and the projection it is read off is put straight
   * back, so what a film renders through is untouched.
   *
   * The price, and it is real: a light or a camera nobody has selected is no longer under the
   * pointer, so it is selected from the scene tree. A resting mark that stays clickable is what
   * would give that back.
   */
  private showAidsForSelection(): void {
    const selected = new Set(this.selectedIds)
    // A window that plays the scene shows none of them, whatever the settings say — the same cut
    // `hideWorkshop` makes for a render, held for the life of the engine rather than one draw.
    const chrome = this.options.chrome !== false
    // An aid stands BESIDE its node rather than under it, so it inherits nothing: a lamp the
    // document hides, or one an isolation excludes, would go on drawing its line across the
    // scene without this. `selected` stays the default and the paragraph above says why.
    const shows = (visibility: HelperVisibility, id: string): boolean =>
      showsAid(visibility, selected, id) && (this.objects.get(id)?.visible ?? false)

    for (const [id, frustum] of this.frustums) {
      const node = this.applied.get(id)
      const camera = this.objects.get(id)
      if (node?.type !== 'camera' || !(camera instanceof PerspectiveCamera)) continue
      applyCamera(camera, node.camera, FRUSTUM_REACH)
      frustum.visible = chrome && shows(this.view.cameraHelpers, id)
    }

    for (const [id, helper] of this.helpers) {
      helper.visible = chrome && shows(this.view.lightHelpers, id)
    }

    // The body of a camera and the bulb of a lamp stand where the thing they draw stands, so a
    // game would be played looking at the marker somebody put there to find the light by.
    if (!chrome) for (const marker of this.markers.values()) marker.visible = false

    const rails = this.workedRailIds()
    for (const [id, node] of this.applied) {
      if (node.type !== 'path') continue
      const rail = this.objects.get(id)
      if (!rail) continue
      if (!chrome) rail.visible = false
      showPathKnobs(rail, chrome && rails.has(id))
    }
  }

  /**
   * The rails being worked on — `railsInUse` holds the rule, so this side and the selection
   * connector cannot come to disagree. Only the ids that ARE rails: everything selected goes in
   * there, and a camera is not a rail.
   */
  private workedRailIds(): Set<string> {
    const rails = new Set<string>()

    for (const id of railsInUse(this.selectedIds, this.timeline.shots)) {
      if (this.applied.get(id)?.type === 'path') rails.add(id)
    }

    return rails
  }

  /** The objects of those rails — what a click may reach a control point of. */
  private workedRails(): Object3D[] {
    return [...this.workedRailIds()].flatMap(id => this.objects.get(id) ?? [])
  }

  /**
   * Where the head stands, in seconds. Session state, so it arrives by a call of its own rather
   * than inside the document — playing would otherwise put one undo entry per frame.
   */
  setPlayhead(time: Us): void {
    if (time === this.playhead) return
    this.playhead = time
    this.applyPoses()
    this.applyCameraShots()
    // The clips of every imported model follow the head too, which is what puts them on the band
    // rather than on real time — and what stops a render from writing a frozen character.
    this.animations.seek(time)
    this.redraw()
  }

  /**
   * Watches one block on a clock of its own, leaving the head where it stands. `null` gives the
   * model back to the head. A loop of its own rather than the head's: this is a look at a block,
   * not a move of the scene's clock.
   */
  setPreview(target: PreviewWatch | null): void {
    cancelAnimationFrame(this.previewFrame)
    this.previewFrame = 0
    this.heldPreview = target?.playing === false ? target : null

    if (!target) {
      this.animations.seek(this.playhead)
      this.redraw()
      return
    }

    // Held at one position: the pose is looked AT, so one frame answers it and no loop follows.
    if (!target.playing) {
      this.animations.preview(target.nodeId, target.clipId, target.at)
      this.redraw()
      return
    }

    const from = performance.now()
    const step = (now: number): void => {
      const length = this.animations.preview(
        target.nodeId,
        target.clipId,
        target.at + (now - from) / 1000,
      )
      this.redraw()
      // The grace stays on the WALL clock and not on the clip's: a run resumed from a scrub
      // starts past a second in, and would give up before the file it waits for had landed.
      if (length > 0 || now - from < 1000) this.previewFrame = requestAnimationFrame(step)
    }

    this.previewFrame = requestAnimationFrame(step)
  }

  /**
   * Puts a HELD pose back after the mixer was asked to apply the document.
   *
   * `SceneAnimations.apply` finishes by posing the model from the scene's head, and a held
   * preview has no loop of its own to write it again — editing the speed of the very block being
   * looked at would otherwise snap the character back to frame zero.
   */
  private holdPreview(nodeId: string): void {
    if (this.heldPreview?.nodeId !== nodeId) return
    this.animations.preview(nodeId, this.heldPreview.clipId, this.heldPreview.at)
  }

  /**
   * Where the shots put their cameras at the instant the head stands on: along a rail, aimed at
   * a target, or both.
   *
   * After `applyPoses` and never before: a camera may be told to watch a node that is itself
   * animated, and aiming at where that node USED to be lags one frame behind for good.
   */
  private applyCameraShots(): void {
    const shots = this.timeline.shots
    // Nothing named and nothing to put back: a scene with no shot at all allocates nothing here,
    // and this runs once per frame of playback.
    if (shots.length === 0 && this.railedCameras.size === 0) return

    // Walked from the SHOTS rather than from the nodes, exactly as `applyLenses` is: a camera no
    // shot names is one this pass has nothing to do to, and this ran over every node per frame.
    const named = new Set(shotCameras(shots))
    const held = new Set(named)

    // The ones the shots have just let go of. Nothing else in the engine writes a camera's
    // position, so a shot deleted — or the undo of one that opened — would leave its camera
    // wherever the rail last put it, and the film would go on being taken from there.
    for (const cameraId of this.railedCameras) {
      if (named.has(cameraId)) continue
      // Held for the next pass when it could not be written — a camera the gizmo carries, whose
      // shot an undo took away mid-drag. Forfeiting the one attempt makes the rail its rest pose
      // on release; a camera the document has lost leaves `applied`, so this cannot pile up.
      if (!this.restCamera(cameraId) && this.applied.has(cameraId)) held.add(cameraId)
    }
    this.railedCameras = held
    if (named.size === 0) return

    const driven: { object: Object3D; shot: CameraShot }[] = []
    for (const cameraId of named) {
      // Where the document holds it, before any shot has its say: unbinding a rail, or deleting
      // it, leaves a shot that covers the head and moves nothing.
      const object = this.restCamera(cameraId)
      if (!object) continue

      const shot = shotOfCameraAt(this.timeline, cameraId, this.playhead)
      if (shot) driven.push({ object, shot })
    }

    // Every rail before any aim, and not one camera at a time: a shot may watch a camera that is
    // itself riding one, and aiming at where that camera stood BEFORE its rail ran is wrong for
    // the whole length of the shot rather than by one scrub step.
    for (const { object, shot } of driven) {
      if (shot.motion) this.railCamera(object, shot, shot.motion)
    }
    for (const { object, shot } of driven) {
      if (shot.target) this.aimCamera(object, shot.target)
    }
  }

  /**
   * A camera put back where the document holds it, tracks included, and the object it stands for.
   * `null` for one the gizmo carries — its transform is relative to the pivot, see `applyPoses`.
   */
  private restCamera(cameraId: string): Object3D | null {
    const node = this.applied.get(cameraId)
    const object = this.objects.get(cameraId)
    if (node?.type !== 'camera' || !object || object.parent === this.pivot) return null

    applyTransform(object, poseAt(node.transform, this.timeline, cameraId, this.playhead))
    return object
  }

  /** Puts a camera where its rail says, in the frame of whatever the camera hangs from. */
  private railCamera(object: Object3D, shot: CameraShot, motion: CameraMotion): void {
    const rail = this.applied.get(motion.pathId)
    const railObject = this.objects.get(motion.pathId)
    if (rail?.type !== 'path' || !railObject) return

    // The two chains this reads, and nothing else. `scene.updateMatrixWorld(true)` stood here
    // and recomposed EVERY object of the scene, bones included, once per frame of playback —
    // some 15 000 compose-and-multiply pairs on a large scene, against the six below. `aimCamera`
    // needs none: `getWorldPosition` refreshes its own chain.
    railObject.updateWorldMatrix(true, false)
    object.parent?.updateWorldMatrix(true, false)

    // `getPointAt`, never `getPoint`: the second is parameterised per segment, so a camera
    // speeds up through the short ones — the very defect a rail exists to avoid. Into a scratch
    // vector, since this runs per frame of playback.
    const along = curveOf(rail.path).getPointAt(
      clampUnit(progressAt(shot, motion, this.playhead)),
      railed,
    )
    const world = railObject.localToWorld(along)
    object.position.copy(object.parent ? object.parent.worldToLocal(world) : world)
  }

  /** Turns a camera towards a point of the scene, or towards whatever a node stands at. */
  private aimCamera(object: Object3D, target: CameraTarget): void {
    if (target.kind === 'point') {
      object.lookAt(target.at.x, target.at.y, target.at.z)
      return
    }

    // A camera cannot watch itself: doing so leaves `lookAt` with a direction of no length, and
    // the quaternion it hands back is the identity — a shot silently aimed down the Z axis.
    const watched = target.nodeId === object.name ? null : this.objects.get(target.nodeId)
    if (watched) object.lookAt(watched.getWorldPosition(aimed))
  }

  /**
   * Lays the timeline over the rest poses. Only the nodes it drives are touched, and a scene
   * with no track at all leaves before building anything.
   */
  private applyPoses(): void {
    const timeline = this.timeline
    if (timeline.tracks.length === 0) return

    // A pose displaces without adding anything, so the counters are left alone and only the
    // shadow reach has to be read again.
    this.placementChanged = true

    for (const nodeId of drivenNodes(timeline)) {
      const object = this.objects.get(nodeId)
      const rest = this.applied.get(nodeId)?.transform
      // A node the gizmo is carrying holds a transform relative to the pivot, not to the scene:
      // writing a world pose into it mid-drag would teleport it, exactly as `syncNode` warns.
      if (!object || !rest || object.parent === this.pivot) continue

      applyTransform(object, poseAt(rest, timeline, nodeId, this.playhead))
    }

    this.applyBonePoses(timeline)
    this.applyLenses(timeline)
  }

  /**
   * What the `fov` channels add to each camera's own field of view, in degrees.
   *
   * Walked from the CHANNELS rather than from the nodes: a scene of a thousand objects and no
   * lens channel is one that leaves here having read nothing.
   */
  private applyLenses(timeline: AnimationTimeline): void {
    const lensed = new Set(
      timeline.tracks.flatMap(track =>
        track.target.property === 'fov' ? track.target.nodeId : [],
      ),
    )

    for (const nodeId of lensed) {
      const node = this.applied.get(nodeId)
      const camera = this.cameraObject(nodeId)
      if (node?.type !== 'camera' || !camera) continue

      // The descriptor itself where every channel is muted or soloed away, never "leave it
      // alone": the lens would otherwise keep whatever the last scrub wrote, on screen and in a
      // render alike.
      applyCamera(camera, lensAt(node.camera, timeline, nodeId, this.playhead))
    }
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
    this.redraw()
  }

  /** Which snaps a drag obeys: the steps `configure` was given, and the surface under it. */
  setSnapping(snapping: Snapping): void {
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
    this.redraw()
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
    this.redraw()
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
    this.redraw()
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
    // Now rather than at the next pointer move: the gizmo reads its own events, and one left
    // aimed at a quarter of the canvas answers a click nowhere near the handle it is drawn on.
    this.aimGizmo()
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
      // A pane locked onto a camera of the scene draws through IT: orbiting there then moves
      // that camera, which is what `onCameraSettled` writes back to the document.
      const locked = isCameraView(view) ? this.cameraObject(view.nodeId) : null
      this.viewport.setPaneCamera(index, locked)
      if (isCameraView(view)) {
        // Rotation given back explicitly: a pane offering a camera is one of panes 1–3, and
        // those START on a side view, where turning is locked. Left alone, the orbit that is
        // supposed to MOVE the camera did nothing at all — seen on screen, green in the suite.
        const orbit = this.viewport.paneOrbits[index]
        if (orbit) orbit.enableRotate = true
        continue
      }

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
    this.redraw()
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

    // Turned off means not COUNTED, never merely not shown: walking every geometry of the scene
    // is the cost this switch exists to give back.
    if (!this.view.stats) {
      report(EMPTY_STATS, EMPTY_STATS)
      return
    }

    // What the MODEL costs, so an isolation does not make the triangle count drop — `statsOf`
    // skips an invisible mesh, and hiding something to look past it is not making it cheaper.
    this.asDocumented(() => {
      // Only when the set moved. `apply` runs on every state change, a selection included, and
      // walking every geometry of the scene again for a number no selection can move was 12 % of
      // the CPU of one click on 8 000 nodes — measured 20/08. The selected side is walked every
      // time on purpose: it is bounded by what is selected, which is usually one thing.
      if (this.contentChanged) {
        this.modelStats = statsOf(this.objects.values())
        this.contentChanged = false
      }
      const selected = this.selectedIds.flatMap(id => this.objects.get(id) ?? [])
      report(this.modelStats, statsOf(selected))
    })
  }

  /**
   * Gives a geometry back to whichever cache lends it, and disposes it when none does.
   *
   * Two of them lend the same class of buffers — the shapes and the solids — and the same node
   * wears one then the other as it is carved. Disposing what a cache lends empties every
   * neighbour of the same shape, with every gate green.
   */
  private freeGeometry(geometry: BufferGeometry): void {
    if (this.csg.owns(geometry)) return
    if (this.shapes.owns(geometry)) {
      this.shapes.release(geometry)
      return
    }
    geometry.dispose()
  }

  /**
   * Both passes a change of CONTENT makes stale — what the counters read, and how the repeated
   * shapes are grouped for drawing. One gesture because forgetting the second is silent: the
   * grouping is the only thing that ever gives a mesh back to the camera's layer.
   */
  private markContentChanged(): void {
    this.contentChanged = true
    this.groupingStale = true
    this.hangAll = true
    // Only a node leaving or being rebuilt can make the scene SMALLER, so that is the one event
    // the held box cannot survive.
    this.shadowBounds = null
  }

  /**
   * Draws the repeated shapes through one `InstancedMesh` per region.
   *
   * Its own pass, and out of `reportStats`: it lived past that method's two early returns, so
   * ten thousand copies were drawn one by one unless the statistics overlay happened to be on —
   * and a node moved while it was off left stale instances with the real meshes still hidden.
   *
   * Outside `asDocumented`, on purpose: the grouping reads `visible` off the objects, which is
   * exactly what that helper sets aside.
   */
  private regroupInstances(): void {
    if (this.groupingStale) {
      this.groupingStale = false
      this.movedNodes.clear()
      // The world matrices are what a group COPIES, and nothing before here refreshes them: the
      // one pass that did is `tuneShadows`, which only runs when a light casts. Without this a
      // body of a fresh group was drawn at the origin.
      this.viewport.scene.updateMatrixWorld()
      // The sources that walk no longer reaches, composed against the parents it just wrote.
      this.instances.refreshSources()
      const instanced = this.instances.rebuild([...this.applied.values()], id =>
        this.objects.get(id),
      )
      this.holdSources()
      // Only when there are instances to dress: they are new objects wearing what their sources
      // wore, so a pane that believed the scene already dressed would leave them out of a solid
      // or a material view. An ordinary scene reaches no group and must pay nothing.
      if (instanced > 0) forgetDress(this.paneMemory)
      return
    }
    if (this.movedNodes.size === 0) return

    // The moved nodes alone, never the whole scene: refreshing all of it costs the traversal of
    // every source — 15 ms against 3 on 50 000 nodes, per typed placement, measured 02/09.
    for (const id of this.movedNodes) this.objects.get(id)?.updateWorldMatrix(true, false)

    // Only the slots that moved. Their region's bounds are widened rather than recut, so the
    // culling stays conservative until the next real change of content puts them back exact.
    this.instances.moved(this.movedNodes, id => this.objects.get(id))
    this.movedNodes.clear()
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
   * Hands the gizmo to the view being worked in — its camera, and the rectangle that view fills.
   * Left untold, `TransformControls` reads its own pointer events against the WHOLE canvas, which
   * in a quad layout normalises a click against four times the surface it was aimed at.
   */
  private aimGizmo(): void {
    const gizmo = this.gizmo
    if (!gizmo) return

    const camera = this.cameraInHand()
    if (gizmo.camera !== camera) {
      gizmo.camera = camera
      // The handles are SIZED in the camera they are aimed from, and a hover asks for no frame.
      this.repaint()
      // On the CHANGE alone: this walks whatever the gizmo holds, and it holds the object itself
      // rather than a pivot for a lone selection — 13.6 µs on an empty pivot against 2.7 ms on a
      // 20 000-node model, which per pointer move would be a third of a frame just to hover.
      this.refreshGizmoMatrices()
    }

    const region = this.viewport.activePaneRegion()
    gizmo.viewport = region
      ? this.gizmoRegion.set(region.x, region.y, region.width, region.height)
      : null
  }

  /**
   * `TransformControls` turns its drag PLANE in `updateMatrixWorld`, which only a RENDER calls —
   * and a hover asks for none, so the plane keeps the orientation of the view one quitted and comes
   * out parallel to the new ray: measured 19/08, ray·normal 0 in « De gauche », nothing moved.
   */
  private refreshGizmoMatrices(): void {
    this.gizmo?.getHelper().updateMatrixWorld(true)
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
    // In DOCUMENT order, not in the order the objects were built: a node rebuilt after an undo
    // is the newest object of the map, and a file that listed it last diffed on every undo.
    const rank = new Map(this.documentOrder.map((node, at) => [node.id, at]))

    // The copies are taken synchronously inside `exportObjects`, so putting the document's own
    // visibility back for the length of this call is enough — an isolation running while somebody
    // exports must not write a file missing whatever they were not looking at.
    return this.asHung(() =>
      this.asDocumented(() =>
        exportObjects(
          roots.flatMap(id => this.objects.get(id) ?? []),
          format,
          {
            // The objects wear node ids, which is what picking reads back off a hit. A file wears
            // the names the document gave them.
            nameOf: id => this.applied.get(id)?.name,
            clipsFor: copies => this.bakedClips(copies),
            rankOf: id => rank.get(id),
          },
        ),
      ),
    )
  }

  /**
   * Runs something against the scene as a TREE, with every body a group draws for back under the
   * node it hangs from.
   *
   * `Object3D.children` is what an exporter writes a parent's contents from, and a source drawn
   * by a group is held out of it — see `heldOutOfDraw`. Reading the scene BY ID needs none of
   * this; walking it downward does. The copies are taken synchronously inside `exportObjects`,
   * so putting them back for the length of the call is enough — the same reasoning as
   * `asDocumented`, which this wraps.
   */
  private asHung<T>(run: () => T): T {
    this.instances.hangSources()
    try {
      return run()
    } finally {
      this.holdSources()
    }
  }

  /**
   * Whether the bodies a group draws for belong in the walk of the scene.
   *
   * They are what carries the EDGES: `applyWireOverlay` hangs a `LineSegments` under each mesh,
   * and a source out of the walk takes its outline with it. So the edge modes pay the traversal
   * the grouping exists to give back — 16.2 ms of scene pass against 0.29 on 50 000 bodies,
   * measured 02/09 — and every other mode does not.
   */
  private holdSources(): void {
    if (this.needsEdges()) this.instances.hangSources()
    else this.instances.dropSources()
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
    if (!canvas || this.options.chrome === false) return

    this.viewHelper?.dispose()
    const helper = new ViewHelper(this.viewport.camera, canvas)
    tuneViewHelper(helper)
    this.viewHelper = helper
    this.redraw()
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
    // After the outlines are hung or dropped: whether the sources belong in the walk is exactly
    // whether they carry any.
    this.holdSources()
    this.redraw()
  }

  /** Whether any view is asking for edges at all — what decides if the geometry is built. */
  private needsEdges(): boolean {
    return this.displays.some(mode => showsEdges(mode, this.quadEdges))
  }

  /** Everything a view dresses: the nodes it holds, and the instances that draw for them. */
  private *dressable(): Generator<Object3D> {
    yield* this.objects.values()
    yield* this.instances.drawn()
  }

  /**
   * How THIS view shows the scene, set while its pass is about to run.
   *
   * A traversal per pane rather than `scene.overrideMaterial`: an override paints everything the
   * renderer draws, gizmo and grid included, and a manipulator drawn as a wireframe is a
   * manipulator nobody can grab. Only the document's own objects are walked — the gizmo, the
   * grid and the trihedron are siblings, never in `objects`.
   */
  private dressPane(index: number, camera: ViewportCamera): boolean {
    // Only while it HOLDS something: three keeps the helper hidden with nothing attached, and
    // writing `true` here showed a gizmo no selection stood behind — it grabs nothing, so the
    // drag fell through to the orbit and turned the scene. A single layout keeps `active` at 0.
    if (this.gizmo?.object) {
      this.gizmo.getHelper().visible = index === this.viewport.activePane
    }

    const mode = this.displays[index] ?? this.displays[0] ?? 'shaded'
    return dressForPane(
      // The instances too: a display mode replaces a mesh's material, and one left out of this
      // walk goes on drawing shaded while everything around it wears the stand-in. Walked
      // LAZILY: `dressForPane` declines the work when the dress already holds, and an array
      // built here would be ten thousand copies per pane per frame on a still viewport.
      this.dressable(),
      mode,
      this.quadEdges,
      this.paneMaterials,
      this.paneMemory,
      camera,
      studio => this.environment?.borrowStudio(studio),
    )
  }

  /**
   * Holds the composition off for as long as the caller says, without touching the document.
   *
   * What the Before/After gesture presses. A render is NOT affected: an off-screen pass resolves
   * its own stack and never reads this — a comparison is a thing one looks at, not a thing one
   * writes out.
   */
  setPostBypassed(bypassed: boolean): void {
    if (bypassed === this.bypassed) return
    this.bypassed = bypassed
    this.redraw()
  }

  /**
   * The composition one surface films through, at the instant it is being drawn.
   *
   * `false` when there is nothing to compose, and the viewport then draws straight — which is
   * what the ON/OFF switch, the bypass and a camera set to `disabled` all come down to. No target
   * is allocated and no chain compiled for a composition nobody asked to see.
   */
  private compose(request: DrawRequest): boolean {
    const composer = this.post
    if (!composer) return false

    const stack = this.stackOf(request)
    if (!stackDraws(stack)) return false

    composer.draw({
      scene: request.scene,
      camera: request.camera,
      stack,
      target: request.target,
      rect: request.rect ?? undefined,
      width: request.width,
      height: request.height,
      // A render is never drawn at the cheap end: what is written out is what the quality
      // setting means at its top, whatever the viewport is set to.
      quality: request.surface === 'offscreen' ? 'high' : this.view.quality,
      toneMapped: this.world.toneMapping !== 'none',
      // The PLAYHEAD, not a wall clock: a film written twice has the same grain twice, and a
      // frame still shows grain because the head moves between them.
      time: this.playhead / SECOND,
    })
    return true
  }

  /**
   * Which stack a surface films through, animated to where the head stands.
   *
   * A pane composes only in `shaded`, the mode that shows a RENDER: the other display modes are
   * there to measure a geometry, and a bloom over a wireframe measures nothing. It is the same
   * rule a compositor follows, and `displays` already carries it per pane.
   */
  private stackOf(request: DrawRequest): PostStack | null {
    // The render is deliberately out: a comparison is something one looks at, never something
    // that changes what a film is written from.
    if (this.bypassed && request.surface !== 'offscreen') return null

    if (request.surface === 'pane') {
      const mode = this.displays[request.paneIndex] ?? this.displays[0] ?? 'shaded'
      return mode === 'shaded' ? this.sceneStack() : null
    }

    return this.cameraStack(request.cameraNodeId)
  }

  /**
   * Frees the chains no composition of the document asks for any more — a camera that stopped
   * overriding, an effect removed from the scene. Without it the only release is the cache's own
   * ceiling, and a stack nothing can name again holds its buffers until six others push it out.
   */
  private sweepCompositions(state: SceneState): void {
    const live = [state.world.post]
    for (const node of state.nodes) {
      if (node.type === 'camera' && node.camera.post?.mode === 'override') {
        live.push(node.camera.post.stack)
      }
    }
    this.post?.sweep(live)
  }

  /** One subject's stack, animated to the head and held for the image — see `animatedStack`. */
  private stackAtHead(rest: PostStack, subject: string): PostStack {
    return this.animated.of(rest, this.timeline, subject, this.playhead)
  }

  /** The scene's own composition, opened by whatever its channels add at this instant. */
  private sceneStack(): PostStack {
    return this.stackAtHead(this.world.post, SCENE_SUBJECT_ID)
  }

  /**
   * What a camera of the document films through. `postOf` is the arbiter — the domain's, and the
   * same one the MCP handlers ask — so the engine only decides WHICH SUBJECT to animate on: a
   * camera overriding hears its own channels, one inheriting hears the scene's.
   */
  private cameraStack(cameraId: string | null): PostStack | null {
    const node = cameraId === null ? null : this.applied.get(cameraId)
    const camera = node?.type === 'camera' ? node.camera.post : undefined
    const stack = postOf(this.world.post, camera)
    if (!stack) return null

    return this.stackAtHead(
      stack,
      camera?.mode === 'override' ? (cameraId ?? '') : SCENE_SUBJECT_ID,
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
    for (const joints of this.joints.values()) joints.points.visible = this.skeletonsVisible()
    this.redraw()
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
   * Weights every mesh of a model against the rig its document holds, then binds them.
   *
   * Off the UI thread and reporting as it goes: half a million vertices against fifty-two bones
   * is twenty-six million distances, and the window has to stay answerable throughout.
   */
  private async skinModel(nodeId: string, holder: Object3D, rig: Rig): Promise<void> {
    // Captured once: `applyRig` is told which meshes these weights belong to rather than walking
    // the holder again after the awaits, when it may hold others.
    const meshes = skinnableMeshesOf(holder)
    if (meshes.length === 0) return

    this.stopSkinning(nodeId)
    const stop = new AbortController()
    this.skinning.set(nodeId, stop)

    try {
      const bound: { mesh: Mesh; binding: SkinBinding }[] = []
      for (const [index, mesh] of meshes.entries()) {
        const binding = await this.skin.bind(positionsIn(mesh, holder), rig, {
          signal: stop.signal,
          onProgress: progress =>
            this.options.onRigProgress?.(nodeId, (index + progress) / meshes.length),
        })
        // Taken back, or the port let go — either way this model is no longer being skinned.
        if (!binding) return
        bound.push({ mesh, binding })
      }

      // The model may have been released while the weights were out.
      if (this.objects.get(nodeId) !== holder) return

      applyRig(holder, rig, bound)
      this.bindIk(nodeId, holder, rig)
      // The bones exist only now: the helper was bound before them, when the holder carried none,
      // and without this a locally rigged character has a skeleton nothing can show or pick.
      this.bindSkeleton(nodeId, holder, true)
      this.options.onRig?.(nodeId, rigStateOf(holder, this.animations.clipsOf(nodeId)))
      this.redraw()
    } finally {
      this.skinning.delete(nodeId)
      // In every exit, cancellation included: what says "binding" is the progress being there,
      // so leaving it behind would hide both buttons of the inspector for good.
      this.options.onRigProgress?.(nodeId, 1)
    }
  }

  /**
   * The chains this model reaches with, if any — solved once a frame in `advance`.
   *
   * Built from the skeleton the rig just made rather than from the document: the solver holds
   * bone INDICES, so it only means anything against the bones actually bound.
   */
  private bindIk(nodeId: string, holder: Object3D, rig: Rig): void {
    this.iks.delete(nodeId)
    if (!rig.ik?.length) return

    const skinned = holder.getObjectByProperty('isSkinnedMesh', true)
    if (!(skinned instanceof SkinnedMesh)) return

    const names = skinned.skeleton.bones.map(one => one.name)
    const binding = createIkBinding(skinned, ikSpecsOf(names, rig.ik))
    if (binding) this.iks.set(nodeId, binding)
  }

  /** Twenty-six million distances are not worth finishing for a model nobody will see again. */
  private stopSkinning(nodeId: string): void {
    this.skinning.get(nodeId)?.abort()
    this.skinning.delete(nodeId)
  }

  /**
   * A helper is built from the instance and hung beside the nodes, like the grid and the
   * trihedron — never inside the model, where the outliner would list it as part of the scene
   * and a click could pick it.
   */
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

    // The joints beside the segments: the helper draws the bones and nothing marks where two of
    // them MEET, which is the thing a click and a gizmo are actually aimed at.
    const joints = createBoneJoints(helper.bones)
    joints.points.visible = helper.visible
    this.joints.set(nodeId, joints)
    this.viewport.scene.add(joints.points)
  }

  private unbindSkeleton(nodeId: string): void {
    const joints = this.joints.get(nodeId)
    if (joints) {
      joints.points.removeFromParent()
      joints.dispose()
      this.joints.delete(nodeId)
    }

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
   * Where a running game puts the free camera. Moved directly rather than through the orbit, for
   * the reason `frameContents` gives — and asking for a frame through `repaint`, since what a
   * camera OF THE SCENE films has not changed.
   */
  placeView(placement: CameraPlacement): void {
    const camera = this.viewport.perspective
    camera.position.set(placement.position.x, placement.position.y, placement.position.z)
    camera.lookAt(placement.target.x, placement.target.y, placement.target.z)
    this.viewport.orbit?.target.set(placement.target.x, placement.target.y, placement.target.z)
    this.repaint()
  }

  /** What a framing and a shadow frustum are both measured against — see `UNFRAMED_NODES`. */
  private framedObjects(): Object3D[] {
    const objects: Object3D[] = []
    for (const [id, object] of this.objects) {
      if (isFramed(this.applied.get(id)?.type ?? 'group')) objects.push(object)
    }
    return objects
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
    const objects = this.framedObjects()
    const bounds = boundsOf(objects)
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

    const camera = this.cameraObject(cameraNodeId) ?? this.viewport.perspective

    this.setPlayhead(time)

    const restore = this.hideWorkshop()
    const loan = aspectLoan(canvas.width, canvas.height)
    loan.frame(camera)

    try {
      gl.setRenderTarget(null)
      gl.render(this.viewport.scene, camera)
    } finally {
      loan.restore()
      restore()
    }
    return canvas
  }

  /**
   * Shows what a camera of the scene films, in a corner of the viewport. `null` closes it.
   *
   * The rectangle is the caller's because the frame drawn around the preview is DOM: two
   * rectangles that agree until one of them drifts would be a border sitting beside its picture.
   * `full` is told for the same reason — the rect is the INSIDE of that frame, so it never
   * measures as covering the canvas even when it does.
   */
  setCameraPreview(preview: CameraPreviewRequest | null): void {
    const camera = this.cameraObject(preview?.cameraNodeId ?? null)
    if (!camera || !preview) return this.viewport.setInsetPane(null)

    // The viewport's own colour, never a panel one: what this shows is a RENDER, and a preview
    // painted on studio chrome would promise a film nobody is going to get.
    const backdrop = new Color(this.viewport.paletteToken('--color-viewport'))
    this.viewport.setInsetPane({
      camera,
      cameraNodeId: preview.cameraNodeId,
      rect: preview.rect,
      backdrop,
      full: preview.full,
    })
  }

  /**
   * Asks for a frame, and says that what the camera preview shows has moved with it.
   *
   * The ONE way this engine asks for a frame, and a guard holds it to that
   * (`SceneRenderer.redraws-the-preview.test.ts`). Everything here changes the scene, the pose or
   * the lens — which is exactly what a preview is a picture of — so the two travel together.
   * What must NOT come through here is the viewport's own camera: orbiting, flying and settling
   * ask for frames straight from `ViewportEngine`, and those frames reuse the picture rather
   * than walking the scene a second time.
   */
  private redraw(): void {
    this.viewport.invalidateInset()
    this.viewport.requestRender()
  }

  /**
   * Asks for a frame and says nothing about the preview: the workshop moved, not the scene.
   *
   * The other half of `redraw`, and named rather than left as a bare call so the two intents can
   * be told apart at a glance — and so the guard can be a plain "none anywhere else" instead of a
   * list of exemptions that would go stale. What belongs here is what `hideWorkshop` hides: the
   * gizmo, the helpers, the grid. Nothing a camera of the scene can film.
   */
  private repaint(): void {
    this.viewport.requestRender()
  }

  /** The camera a node id stands for, or `null` when nothing in the scene answers to it. */
  private cameraObject(cameraNodeId: string | null): PerspectiveCamera | null {
    const aimed = cameraNodeId ? this.objects.get(cameraNodeId) : null
    return aimed instanceof PerspectiveCamera ? aimed : null
  }

  /**
   * Hides everything the workshop draws for the person editing — light helpers, camera
   * frustums, skeletons, the grid, the rails, the transform gizmo — and hands back the call
   * that puts them all back.
   *
   * A render is the scene, not the tools it was built with. A directional light's helper is a
   * line drawn clean across the picture, and it was in every frame of both the film and the
   * montage. Only what was actually visible is restored: a helper already hidden by a setting
   * must not be turned on by a render passing through.
   *
   * An isolation is one of those tools, and it is put back the same way: what a camera films is
   * the scene, never the part of it somebody happened to be working on.
   */
  private hideWorkshop(): () => void {
    const hidden: Object3D[] = []
    const hide = (object: Object3D | null | undefined): void => {
      if (!object?.visible) return
      object.visible = false
      hidden.push(object)
    }

    // Before the hiding below: this shows nodes again, and a helper hidden after it stays hidden.
    const masked = isolating(this.isolation)
    if (masked) {
      for (const [id, node] of this.applied) {
        const object = this.objects.get(id)
        if (object) object.visible = node.visible
      }
    }

    // A studio VIEW borrows three's neutral room, and only `dressPane` gives it back — which a
    // film and a capture never go through, since they render the scene directly. Left alone, the
    // whole film comes out lit by the room instead of by the document's own sky.
    this.environment?.borrowStudio(false)

    for (const helper of this.helpers.values()) hide(helper)
    for (const skeleton of this.skeletons.values()) hide(skeleton)
    for (const joints of this.joints.values()) hide(joints.points)
    for (const frustum of this.frustums.values()) hide(frustum)
    // A body and a bulb are workshop furniture too: they stand where the thing they draw stands,
    // so a camera aimed at a lamp would otherwise film the bulb somebody drew to find it by.
    for (const marker of this.markers.values()) hide(marker)
    hide(this.grid)
    // Boxes, origins and normals, in one flag: they hang from a group of their own for this.
    hide(this.aids.object)
    // The arrows a person drags an object by. They stand where the object stands, so a camera
    // aimed at a selected node fills its preview — and its film — with the tool instead.
    hide(this.gizmo?.getHelper())

    // A rail is a working aid like the grid, not something a shot puts on screen: drawn, its
    // line and its knobs would run across every previewed and every rendered frame.
    for (const node of this.applied.values()) {
      if (node.type === 'path') hide(this.objects.get(node.id))
    }

    return () => {
      for (const object of hidden) object.visible = true
      if (masked) this.applyVisibility()
    }
  }

  /**
   * Draws the film one frame at a time, through whichever camera `cameraAt` names for that
   * instant, and hands each one over already encoded as a PNG.
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
    cameraAt: (time: Us) => string | null,
    request: FilmRequest,
    onFrame: (index: number, png: Uint8Array) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    const gl = this.viewport.gl
    let camera = this.cameraObject(cameraAt(0))
    if (!gl || !camera) throw new Error('no camera to render from')

    const { width, height } = evenSize(request)
    const target = new WebGLRenderTarget(width, height)
    const pixels = new Uint8Array(width * height * 4)

    const restore = this.hideWorkshop()
    const loan = aspectLoan(width, height)

    const head = this.playhead

    try {
      let index = 0
      for (const time of frameTimes(request.duration, request.fps)) {
        if (signal?.aborted) return

        // Resolved per frame: a shot hands the film to another camera mid-way, and the frame
        // after a camera is deleted keeps the last one rather than throwing at the encoder.
        camera = this.cameraObject(cameraAt(time)) ?? camera
        loan.frame(camera)

        this.setPlayhead(time)
        const composed = this.viewport.drawScene({
          scene: this.viewport.scene,
          camera,
          surface: 'offscreen',
          paneIndex: 0,
          // Named for THIS frame: a shot hands the film to another camera mid-way, and the
          // composition that camera films through is the one to resolve.
          cameraNodeId: cameraAt(time),
          target,
          rect: null,
          width,
          height,
        })
        gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)

        index += 1
        await onFrame(index, await encodeFilmFrameOffThread(pixels, width, height, composed))
      }
    } finally {
      gl.setRenderTarget(null)
      target.dispose()
      loan.restore()
      restore()
      // Where the head was before the film was asked for: a render is not an edit.
      this.setPlayhead(head)
      this.redraw()
    }
  }

  /**
   * One still of the view being worked in, encoded as a PNG — what is posted, and what a
   * template thumbnail is drawn with.
   *
   * Off screen and through the same door a film goes through: `hideWorkshop` takes the grid, the
   * gizmos, the rails and the light bodies out, so what comes back is the SCENE and not a
   * picture of the workshop around it. The framing never changes — only the pixel count does.
   *
   * The colour is encoded on the way out (`flipToSrgbInto`): three writes the working space into
   * a render target, and a linear buffer written straight into a PNG comes out washed out.
   */
  async captureStill(quality: CaptureQuality): Promise<Uint8Array> {
    const gl = this.viewport.gl
    if (!gl) throw new Error('this scene has no viewport mounted to capture from')

    const camera = this.cameraInHand()
    const canvas = gl.domElement
    // The pane in hand when there are four of them; the whole canvas when there is one. A quad
    // layout captured at the canvas's shape would show more scene than the pane it was asked of.
    const pane = this.viewport.activePaneRegion()
    const shown = pane ?? { width: canvas.clientWidth, height: canvas.clientHeight }
    // Times the device ratio, because both measures above are CSS pixels while the frame on
    // screen is drawn at the buffer's own: « view size » on a 2× display gave back half the
    // definition of what was being looked at.
    const ratio = gl.getPixelRatio()
    const { width, height } = captureSize(
      { width: shown.width * ratio, height: shown.height * ratio },
      quality,
    )

    // Antialiased, unlike a film's frames: a still is looked at, and the resolve happens at the
    // end of `render` — so the read below already has the resolved texture. Capped at four,
    // which is where the eye stops paying for the memory a 4K target multiplies.
    const samples = Math.min(4, gl.capabilities.maxSamples)
    const target = new WebGLRenderTarget(width, height, { samples })
    const pixels = new Uint8Array(width * height * 4)

    const restore = this.hideWorkshop()
    const loan = aspectLoan(width, height)

    try {
      // Only a perspective one is lent an aspect, and only for the rounding: the size asked for
      // keeps the view's own shape, so an orthographic frustum is already framed for it.
      if (camera instanceof PerspectiveCamera) loan.frame(camera)

      const composed = this.viewport.drawScene({
        scene: this.viewport.scene,
        camera,
        surface: 'offscreen',
        paneIndex: 0,
        // The view in hand rather than a camera of the document, so the composition is the
        // SCENE's — which is exactly what is on screen.
        cameraNodeId: null,
        target,
        rect: null,
        width,
        height,
      })
      gl.readRenderTargetPixels(target, 0, 0, width, height, pixels)

      return await encodeFilmFrameOffThread(pixels, width, height, composed)
    } finally {
      gl.setRenderTarget(null)
      target.dispose()
      loan.restore()
      restore()
      this.redraw()
    }
  }

  /**
   * Arms the persistent navigation mode: the pointer is captured, the mouse becomes the head and
   * the keys fly without a button held.
   *
   * The capture is what settles the keyboard too — `flying` covers this mode, so `S` means back
   * rather than scale for exactly as long as the mode is on.
   */
  setNavigating(on: boolean): void {
    if (on === this.navigating) return

    const canvas = this.viewport.canvas
    if (on) {
      if (!canvas) return

      this.navigating = true
      this.look = anglesFromDirection(this.viewport.camera.getWorldDirection(flightGaze), this.look)
      document.addEventListener('pointerlockchange', this.onPointerLockChange)
      canvas.addEventListener('pointermove', this.onLookMove)
      // Before the first turn: an orbit left running ends its frame on `lookAt(target)`, which
      // is exactly the rotation this mode writes — the head would snap back every frame.
      this.syncPaneFreeze()
      // A capture refused — no gesture behind the call — must not leave the bar lit over a mode
      // that never opened. Not awaited, so the `.catch` is a handler, not a chain under an await.
      void canvas.requestPointerLock()?.catch(() => this.setNavigating(false))
      // Before the first frame of the mode, or its opening step spans the whole idle time.
      this.viewport.resetClock()
      this.repaint()
      return
    }

    this.navigating = false
    document.removeEventListener('pointerlockchange', this.onPointerLockChange)
    canvas?.removeEventListener('pointermove', this.onLookMove)
    if (document.pointerLockElement === canvas) document.exitPointerLock()
    this.held.clear()
    // Only for a mode that engaged: a capture refused never flew anywhere, and resting the pivot
    // would swing the next drag for a reason nothing on screen explains.
    if (this.captured) this.restPivot()
    this.captured = false
    // After `restPivot`: thawing re-arms the orbit, and it must find the pivot already ahead.
    this.syncPaneFreeze()
    this.options.onNavigatingChange?.(false)
    this.repaint()
  }

  /**
   * Put back ahead of the camera: left where a flight walked away from it, the first drag
   * afterwards orbits a point off screen — the trap `turnToViewHelper` guards the trihedron against.
   */
  private restPivot(): void {
    const orbit = this.viewport.orbit
    if (!orbit) return

    const camera = this.viewport.camera
    orbit.target
      .copy(camera.position)
      .addScaledVector(camera.getWorldDirection(flightGaze), PIVOT_AHEAD)
    orbit.update()
  }

  /** Escape releases the capture without telling this engine; the browser's own event does. */
  private readonly onPointerLockChange = (): void => {
    if (document.pointerLockElement === this.viewport.canvas) {
      this.captured = true
      return
    }
    this.setNavigating(false)
  }

  /** Sign flipped against `turnBy`, written for a hand that GRABS the world: here the mouse IS the head. */
  private readonly onLookMove = (event: PointerEvent): void => {
    if (!this.navigating) return

    this.look = turnBy(this.look, -event.movementX, -event.movementY)
    aimAlong(this.viewport.camera, this.look)
    this.repaint()
  }

  /**
   * The wheel means speed in the armed MODE alone, never under a held button: there the wheel
   * still dollies, which is what the manual promises and what the hint — mode-only — could say.
   */
  private spendWheelOnSpeed(event: WheelEvent): boolean {
    if (!this.navigating) return false

    this.sessionFlySpeed = speedAfterWheel(this.flySpeed, notchesOf(event.deltaY))
    this.options.onFlySpeedChange?.(this.sessionFlySpeed)
    return true
  }

  /**
   * The same session speed the wheel writes, set from a surface instead — the snap bar. Clamped
   * here rather than at the caller: two surfaces reaching the same value must share its bounds.
   */
  setFlySpeed(speed: number): void {
    this.sessionFlySpeed = clampFlySpeed(speed)
    this.options.onFlySpeedChange?.(this.sessionFlySpeed)
  }

  /** What this session flies at: the wheel's value while one was set, the preference otherwise. */
  private get flySpeed(): number {
    return this.sessionFlySpeed ?? this.view.flySpeed
  }

  setMotion(held: Set<MotionId>): void {
    this.held.clear()
    for (const motion of held) this.held.add(motion)
    if (this.flying && this.held.size > 0) this.redraw()
  }

  /**
   * Whether the camera owns the keyboard — a button held, or the mode armed.
   *
   * Public because a key can mean two things at once: ⇧A opens the Add menu and is also
   * boost-strafe-left, and the held set cannot tell them apart — Shift is down either way.
   */
  get flying(): boolean {
    return this.flownWith !== null || this.navigating
  }

  dispose(): void {
    // A preview left running would keep posing a model whose caches this method is about to drop.
    cancelAnimationFrame(this.previewFrame)
    this.previewFrame = 0
    this.heldPreview = null

    this.stopPaletteWatch?.()
    this.stopPaletteWatch = null
    // Or the last drag's roots outlive every node they name.
    this.surfaceScope.length = 0

    const canvas = this.viewport.canvas
    this.setNavigating(false)

    canvas?.removeEventListener('pointerdown', this.onPointerDown)
    canvas?.removeEventListener('contextmenu', this.onContextMenu)
    window.removeEventListener('pointerup', this.onPointerUp)

    this.gizmo?.removeEventListener('axis-changed', this.onGizmoAxisChanged)
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
    this.post?.dispose()
    this.post = null
    this.textureCache.dispose()
    this.modelCache.dispose()
    this.csg.dispose()
    this.shapes.dispose()
    this.instances.dispose()
    this.gltf.dispose()
    this.wireMaterial.dispose()
    this.paneMaterials.dispose()
    this.bvh.dispose()
    this.skin.dispose()
    this.retarget.dispose()
    this.clipSources.dispose()
    this.bundled.clear()
    this.iks.clear()

    this.grid?.dispose()
    this.grid = null
    this.ground.dispose()
    this.sun.dispose()
    this.aids.dispose()

    this.viewport.dispose()
  }

  /**
   * One model wearing what it should. Read from `applied` rather than taken as an argument: the
   * answer can arrive a query later, and the node may have moved on by then.
   */
  private dressModel(nodeId: string): void {
    const maps = this.modelMaps.get(nodeId)
    const node = this.applied.get(nodeId)
    if (!maps || node?.type !== 'model') return

    const dress = node.model.dress
    // Every slot, always: a slot dropped from the list goes back to its own material. And one
    // pass for a model that carries NO material to write into — `apply` is what says so out loud,
    // and a loop bounded by zero never reaches it.
    const passes = dress ? Math.max(maps.count(), 1) : maps.count()
    for (let slot = 0; slot < passes; slot += 1) {
      const worn = dress ? (this.options.wornDress?.(dress, slot) ?? null) : null

      maps.apply(slot, worn?.textures ?? {})
      // After the maps, always: the tiling rides ON the textures — see `dress`.
      maps.dress(slot, worn?.material)
    }
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
      // A solid wears the same descriptor and registers the same slots — `carriesMaterial` is
      // what keeps the three in step, where a list of types drifts.
      if (node && carriesMaterial(node)) maps.apply(node.material)
    }
    for (const [id, maps] of this.spriteMaps) {
      const node = this.applied.get(id)
      if (node?.type === 'sprite') maps.apply(node.sprite)
    }
    this.dressModels()
    // The environment too: a skybox asset is a picture of the project like any other, and the
    // lighting it drives is what would otherwise stay on the image the edit replaced.
    void this.sky.refresh()
  }

  /**
   * The models wearing one of these material documents ask again for what their dress is worth —
   * every model when none is named. The push behind « edit the material and the model follows »:
   * the document a node names moved, and no id of this scene did.
   */
  dressModels(materialIds?: readonly string[]): void {
    const wanted = materialIds && new Set(materialIds)

    for (const id of this.modelMaps.keys()) {
      const node = this.applied.get(id)
      if (
        wanted &&
        !(node?.type === 'model' && wornMaterials(node.model.dress).some(one => wanted.has(one)))
      ) {
        continue
      }
      this.dressModel(id)
    }
  }

  /**
   * The viewport settings changed. The grid is rebuilt rather than resized — `GridHelper` bakes
   * its geometry at construction — and the camera's projection matrix has to be recomputed by
   * hand, since three.js never reads `fov` back on its own.
   */
  configure(next: ViewportOptions): void {
    const held = this.view
    const gridMoved = next.showGrid !== held.showGrid || next.gridSize !== held.gridSize
    const lensMoved = next.fieldOfView !== held.fieldOfView
    // The cap moves the size a light is actually given, so a quality change resizes maps too.
    const shadowsResized =
      shadowMapSizeFor(next.quality, next.shadowMapSize) !==
      shadowMapSizeFor(held.quality, held.shadowMapSize)
    const shadowsMoved =
      shadowsResized || next.shadowQuality !== held.shadowQuality || next.shadows !== held.shadows

    // A preference the user just edited wins over whatever the wheel left behind, and only then:
    // dropped on every configure, an unrelated setting would reset a speed mid-flight.
    if (next.flySpeed !== held.flySpeed) {
      this.sessionFlySpeed = null
      // Or the overlay goes on showing what the wheel last produced while the camera flies at
      // the figure the person just typed.
      this.options.onFlySpeedChange?.(next.flySpeed)
    }

    this.view = next

    // Through the viewport rather than onto the camera: the orthographic frustum is derived
    // from this very field of view, and has to be resized with it.
    if (lensMoved) this.viewport.setFieldOfView(next.fieldOfView)

    // Unconditional, both of them: a step changed while snapping is off has to be waiting when
    // it comes on, and the handles are rebuilt from `size` on the frame after it moves.
    this.applySnap()
    this.applyGizmoSize()

    const gl = this.viewport.gl
    if (gl) {
      applyShadowQuality(gl, next.shadowQuality)
      applyShadows(gl, next.shadows, this.viewport.scene)
    }
    this.viewport.setPixelRatio(pixelRatioFor(next.quality))

    // Every light, not only the ones built after the change: a map is allocated per light, and
    // the grid is the floor under the reach a directional one is given.
    if (shadowsResized || gridMoved) this.tuneShadows()

    if (gridMoved && this.viewport.canvas) this.applyPalette()
    if (aidsMoved(held, next)) this.refreshAids()
    if (helperVisibilityMoved(held, next)) this.showAidsForSelection()
    if (next.stats !== held.stats) this.reportStats()
    if (gridMoved || lensMoved || shadowsMoved) this.redraw()
  }

  /**
   * The boxes, origins and normals, rebuilt from what is on stage and what the settings ask for.
   *
   * Called from `apply`, which runs on every state change — a selection, a frame of a slider
   * drag. Nothing asked for and nothing drawn is the ordinary case and has to cost nothing: the
   * three palette reads below are `getComputedStyle` calls, on a DOM React has just touched.
   */
  private refreshAids(): void {
    const wants =
      this.view.boundingBoxes !== 'off' ||
      this.view.origins ||
      this.view.normals ||
      !this.aids.idle()
    if (!wants) return

    this.aids.apply(this.objects, this.selectedIds, this.view, {
      box: this.viewport.paletteToken('--color-accent'),
      origin: this.viewport.paletteToken('--color-muted'),
      normal: this.viewport.paletteToken('--color-accent'),
    })
    this.redraw()
  }

  /**
   * Lays what is dragged onto whatever is under it, once per frame of the gesture.
   *
   * Recomputed from the drag's own start each time rather than added to the last result:
   * `TransformControls` rewrites the pivot from `_positionStart` on every move, so a correction
   * folded into the previous one would drift for as long as the gesture lasts.
   */
  private layOnSurface(): void {
    // What the GIZMO holds, never the pivot: a lone selection attaches straight to its object and
    // leaves the pivot empty — `gizmoTargetFor` routes only two nodes and up through it. Read from
    // the pivot, the snap did nothing at all on one object, which is its main use.
    const held = this.gizmo?.object
    if (!this.snapping.surface || this.mode !== 'translate' || !held) return

    const aligning = this.view.snapSurfaceAlign
    if (aligning) held.quaternion.copy(this.surfaceHeld)
    held.updateMatrixWorld(true)
    this.surfaceBox.setFromObject(held)
    if (this.surfaceBox.isEmpty()) return

    this.surfaceRay.set(surfaceRayFrom(this.surfaceBox, this.surfaceFrom), DOWNWARD)
    const hit = this.surfaceRay
      .intersectObjects(this.surfaceRoots(), true)
      .find(candidate => this.landsOn(candidate.object, held))
    if (!hit) return

    // Measured AFTER the turn: an object tipped onto a slope has a new lowest point, and lifting
    // it by the one it had upright buries whichever corner the rotation just brought down.
    if (aligning && hit.normal) {
      surfaceTurn(
        this.surfaceNormal
          .copy(hit.normal)
          .applyMatrix3(SURFACE_NORMAL.getNormalMatrix(hit.object.matrixWorld)),
        this.surfaceHeld,
        held.quaternion,
      )
      held.updateMatrixWorld(true)
      this.surfaceBox.setFromObject(held)
    }

    held.position.y += surfaceLift(this.surfaceBox.min.y, hit.point.y, this.view.snapSurfaceOffset)
    held.updateMatrixWorld(true)
  }

  /**
   * Where the ray starts looking. The ROOTS alone: `this.objects` holds parents AND descendants,
   * so handing it every one makes a node at depth *d* intersect *d+1* times.
   *
   * Written into a kept array rather than built: this answers once per frame of a drag, and the
   * spread alone allocated a second list the size of the scene each time.
   */
  private surfaceRoots(): Object3D[] {
    this.surfaceScope.length = 0
    for (const object of this.objects.values()) {
      if (object.parent === this.viewport.scene) this.surfaceScope.push(object)
    }

    return this.surfaceScope
  }

  /**
   * Whether something the ray met is a surface to rest on: a `Mesh` and nothing else — a rail is
   * a `Line` and its knobs are spheres, neither of which is ground — never what is being dragged,
   * and never scenery the picker already refuses. Landing on a wall somebody isolated away is the
   * same defect as picking one.
   */
  private landsOn(object: Object3D, held: Object3D): boolean {
    if (!(object instanceof Mesh) || heldBy(object, held)) return false
    return isScenery(object, id => this.applied.get(id)?.type === 'path')
  }

  /**
   * How much of the SCREEN the handles take. `TransformControls` divides the distance out of
   * their scale, so they never shrink with it — this is the share of the frame they keep, and
   * the default of 1 covered half the view.
   */
  private applyGizmoSize(): void {
    const held = this.gizmo?.object
    if (!this.gizmo || !held) return

    held.updateMatrixWorld(true)
    this.gizmoBox.setFromObject(held)
    // The MODE decides how far the outermost handle stands: a rotation ring reaches further than
    // an arrow, so the same size wraps two different radii.
    if (this.mode === 'select') return
    this.gizmo.size = gizmoSizeFor(
      this.view.gizmoSize,
      heldRadius(this.gizmoBox, this.gizmoSpan),
      screenFactor(
        this.viewport.camera,
        this.viewport.camera.getWorldPosition(this.gizmoEye),
        held.getWorldPosition(this.gizmoSpot),
      ),
      this.mode,
    )
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
    // A ground with no colour of its own reads the palette like a mesh does, and `applyPalette`
    // does not reach it: it is not a node, so the loop below never walks it.
    this.applyGround()

    const nodes = [...this.applied.values()]
    this.applied.clear()
    for (const node of nodes) this.syncNode(node)
    this.poseMarkers(nodes)

    this.redraw()
  }

  /**
   * The half of a document that belongs to no node, pushed into three.js.
   *
   * Compared field by field rather than by reference: a command replaces the whole world object
   * for a one-field edit, and prefiltering an environment or rebuilding a ground on every apply
   * would cost a mip chain per keystroke.
   */
  private applyWorld(wanted: SceneWorld): void {
    const held = this.world
    this.world = wanted

    this.applyEnvironment(wanted)

    if (wanted.fog !== held.fog) applyFog(this.viewport.scene, wanted.fog)

    const gl = this.viewport.gl
    if (gl && (wanted.toneMapping !== held.toneMapping || wanted.exposure !== held.exposure)) {
      applyToneMapping(gl, wanted.toneMapping, wanted.exposure)
    }

    if (wanted.ground !== held.ground) this.applyGround()
    if (wanted.background !== held.background) this.paintBackground()
  }

  /**
   * What lights the scene: the sky it names, its sun, and the scene's own two dials OVER them.
   * Held by IDENTITY, which `environmentDressOf` makes stable — `lightAgain` fires on every edit
   * of every open sky, and a scene naming none of them must not pay a frame for the news.
   */
  private applyEnvironment(wanted: SceneWorld): boolean {
    const environment = this.environment
    if (!environment) return false

    const dress = this.options.environmentDress?.(wanted.environment) ?? null
    const lit = this.lit
    if (
      lit &&
      lit.dress === dress &&
      lit.intensity === wanted.envIntensity &&
      lit.rotation === wanted.envRotation
    ) {
      return false
    }
    if (dress?.sun !== lit?.dress?.sun) this.sun.apply(dress?.sun ?? null)
    this.lit = { dress, intensity: wanted.envIntensity, rotation: wanted.envRotation }

    void this.sky.apply(environment, dress)

    // A MULTIPLIER over the studio's own strength, never the strength itself: the viewport has
    // always lit at `STUDIO_INTENSITY`, and a document opening at 1 would relight every scene
    // ever saved.
    environment.setIntensity(STUDIO_INTENSITY * wanted.envIntensity * (dress?.intensity ?? 1))
    environment.setRotation(wanted.envRotation)

    return true
  }

  /**
   * The sky it names says the scene is lit again. A pass that changed nothing asks for NO frame:
   * `redraw` marks the shadow maps stale, measured on this Mac at 0.7 to 2.7 ms.
   */
  lightAgain(): void {
    if (this.applyEnvironment(this.world)) this.redraw()
  }

  private applyGround(): void {
    this.ground.apply(this.world.ground, this.viewport.paletteToken('--color-mesh'))
    this.redraw()
  }

  /**
   * What hangs behind the scene.
   *
   * A sky asked to light the scene without being SEEN is the case that makes this more than a
   * colour: the environment keeps prefiltering — the reflections stay — and only the picture
   * stops being drawn. That is what `setBackgroundVisible` is for, and why the choice is settled
   * here rather than by whoever loads the sky.
   */
  private paintBackground(): void {
    const wanted = this.world.background
    // A scene drawn for compositing keeps nothing behind it: a backdrop would hide every clip
    // this one is laid over. It outranks the document — a montage never asked for a backdrop.
    const shows = !this.transparent && wanted.kind === 'environment'
    this.environment?.setBackgroundVisible(shows)
    // Only the picture carries it, so any other backdrop puts it back to sharp rather than
    // leaving the previous softening on the next sky that hangs there.
    this.environment?.setBackgroundBlur(wanted.kind === 'environment' ? wanted.blur : 0)

    if (shows && this.sky.showsSky()) return

    if (this.transparent || wanted.kind === 'transparent') {
      this.viewport.scene.background = null
      return
    }

    this.viewport.setBackgroundColor(
      wanted.kind === 'color' ? wanted.color : this.viewport.paletteToken('--color-viewport'),
    )
  }

  /** Pulls the studio palette off the canvas, so the viewport follows a theme change with it. */
  private applyPalette(): void {
    // The centre axes take the muted token so they stand out from the grid rather than blend in.
    const axis = this.viewport.paletteToken('--color-muted')
    const line = this.viewport.paletteToken('--color-viewport-line')

    this.meshColor = this.viewport.paletteToken('--color-mesh')
    // `elevated` is what a marker is made of and `muted` what outlines it: the fill sits a step
    // off the viewport so the body reads as an object, and the edges carry the shape.
    this.markerColor = this.viewport.paletteToken('--color-elevated')
    this.markerEdge = this.viewport.paletteToken('--color-muted')
    this.negativeColor = this.viewport.paletteToken('--color-danger')
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
    // JUST under the zero plane, where a floor laid on it hides the grid rather than fighting it
    // for the same depth. Coplanar, the two flickered against each other square by square, and a
    // level that lays its own ground had the reference grid drawn across it.
    this.grid.position.y = -GRID_SINKAGE
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

    // Past that guard something about this node really changed — its shape, or where it stands.
    // A selection changes no node, so it never reaches here: that walk was 12 % of the CPU of
    // one click on 8 000 nodes, measured 20/08.
    //
    // A node that only MOVED keeps its slot, so the slot is rewritten rather than the grouping
    // redone: 47.5 ms against 1.35 µs on 40 000 nodes. The counters are left alone too —
    // `keepsItsGroup` lets nothing they read through.
    if (previous && keepsItsGroup(previous, node)) this.movedNodes.add(node.id)
    else this.markContentChanged()
    this.placementChanged = true

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
    // The shadows are NOT tuned here: their reach is read off what the scene occupies, and a
    // light synced before the set it lights would measure half a level. `apply` does it once
    // the last node is in place.

    // Before anything is retargeted onto it: the document is where a bone's role was PUT RIGHT,
    // and the port would otherwise go on reading roles off names that lied.
    if (node.type === 'model' && node.model.rig) this.learnRig(node.model.rig)

    // The clips of a model that is already on stage. Skipped for one still loading: `buildModel`
    // binds what the file brought the moment it lands, and applies this reference there.
    if (node.type === 'model' && this.animations.has(node.id)) {
      this.animations.apply(node.id, node.model.lanes ?? [])
      this.ensureBundled(node.id, node.model.lanes ?? [])
      this.holdPreview(node.id)
      this.redraw()
    }

    // A carried object holds a transform relative to the pivot, and the state holds one relative
    // to the scene: writing the second into the first mid-drag teleports it. The release puts
    // the truth back, so an undo during a gesture repaints everything but where things are.
    if (object.parent !== this.pivot) applyTransform(object, node.transform)
    object.visible = drawsNode(this.isolation, node.id, node.visible)

    const helper = this.helpers.get(node.id)
    if (helper) {
      helper.visible = object.visible
      // After the move, never before: the helper draws where the light was until it is told.
      helper.update()
    }
  }

  /**
   * What the VIEWPORT hides, on top of what the document already does.
   *
   * A pass of its own because nothing about the nodes changed: `syncNode` skips a node it has
   * already applied, so an isolation pushed through the document would never reach the screen.
   */
  setIsolation(isolation: Isolation): void {
    this.isolation = isolation
    // Here rather than in `applyVisibility`: this is the one call of the three that CHANGES what
    // is visible, and `statsOf` skips a hidden mesh — see there.
    this.markContentChanged()
    this.applyVisibility()
    this.showAidsForSelection()
    this.refreshAids()
    this.regroupInstances()
    this.reportStats()
    this.redraw()
  }

  /**
   * Every node's `visible`, from what the document says and what the viewport hides over it.
   *
   * It does NOT mark the counters stale, though hiding a mesh moves them: two of its three
   * callers RESTORE a visibility they had just set aside — `asDocumented` and the workshop's
   * own — and marking here made every read under an isolation walk the whole scene again.
   */
  private applyVisibility(): void {
    for (const [id, node] of this.applied) {
      const object = this.objects.get(id)
      if (object) object.visible = drawsNode(this.isolation, id, node.visible)
    }
  }

  /**
   * Runs something against the scene the DOCUMENT describes, with whatever the viewport is
   * hiding put back for the length of the call.
   *
   * `Object3D.visible` is the one flag three.js draws, picks, counts AND exports through, so an
   * isolation left in place reaches all four — a `.glb` written mid-isolation comes out amputated,
   * and `onlyVisible` makes that a silent success rather than an error. Isolating is a way of
   * LOOKING; anything that leaves the viewport has to see past it.
   */
  private asDocumented<T>(run: () => T): T {
    if (!isolating(this.isolation)) return run()

    for (const [id, node] of this.applied) {
      const object = this.objects.get(id)
      if (object) object.visible = node.visible
    }
    try {
      return run()
    } finally {
      this.applyVisibility()
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
      // The tiling too, and not only the shape: the repeat lives in the UVs, so changing it is
      // rebuilding the geometry — a material comparison alone would leave the floor stretched.
      if (
        before?.geometry !== node.geometry ||
        before.material.tilesPerMetre !== node.material.tilesPerMetre
      ) {
        const worn = wearGeometry(
          object,
          this.shapes.acquire(node.geometry, node.material.tilesPerMetre),
        )
        // A descriptor minted again with the same content lands here — the comparison above is
        // by reference. The mesh keeps the shape it wore, so the reference just taken is given
        // straight back; held, it would pin the shape for the life of the engine.
        if (worn) this.freeGeometry(worn)
        else this.shapes.release(object.geometry)
        // The edges were built from the shape that just went: rebuilt, or they outline a mesh
        // that no longer exists.
        if (this.needsEdges()) this.applyDisplay(object)
      }

      this.paintShape(object, node, before)
      return
    }

    if (node.type === 'light' && object instanceof Light) {
      const before = previous?.type === 'light' ? previous : null
      if (before?.light === node.light) return

      applyLight(object, node.light)

      const marker = this.markers.get(node.id)
      // Everything the body reads — the colour it glows, the cone its doors open to — is written
      // into the one already hanging there. The kind is compared rather than assumed, but no
      // command changes it today: `setLightOn` refuses a node whose kind differs from the anchor,
      // and a kind that did change would leave the three.js light itself the wrong class.
      if (marker && before?.light.kind === node.light.kind) applyLightBody(marker, node.light)
      else this.dressLight(node.id, object, node.light)
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
      if (before?.model.dress !== node.model.dress) this.dressModel(node.id)
      return
    }

    if (node.type === 'camera' && object instanceof PerspectiveCamera) {
      const before = previous?.type === 'camera' ? previous : null
      // The lens, and the frustum drawn from it: a helper left alone would keep outlining the
      // field of view the camera had before the inspector changed it.
      if (before?.camera !== node.camera) applyCamera(object, node.camera)
      return
    }

    if (node.type === 'path') {
      const before = previous?.type === 'path' ? previous : null
      if (before?.path !== node.path) applyPath(object, node.path, this.meshColor)
      return
    }

    if (node.type === 'carved' && object instanceof Mesh) {
      const before = previous?.type === 'carved' ? previous : null
      // Cut again only when the RECIPE moved: a colour change must not send the worker off, which
      // is the one edit here that costs anything.
      if (before?.carved !== node.carved) void this.recut(node, object)

      this.paintShape(object, node, before)
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

  /**
   * What a shape is painted with — its material, then the TOOL MARK that overrides it.
   *
   * The mark belongs in the same test as the material: taking one off repaints nothing otherwise,
   * and the shape stays red for the rest of the session. The texture slots follow, exactly as a
   * mesh's do — without them a map assigned in the inspector changes the document and not the
   * screen.
   */
  private paintShape(object: Mesh, node: MeshNode | CarvedNode, before: SceneNode | null): void {
    const material = standardMaterialOf(object)
    const wore = before?.id === node.id && isCarvable(before) ? before : null
    if (!material || (wore?.material === node.material && wore.negative === node.negative)) return

    applyMaterial(material, node.material, this.meshColor)
    applyNegative(material, this.negativeColor, isNegative(node))
    this.textures.get(node.id)?.apply(node.material)
  }

  private build(node: SceneNode): Object3D {
    if (node.type === 'mesh') return this.buildMesh(node)
    if (node.type === 'light') return this.buildLight(node)
    if (node.type === 'model') return this.buildModel(node)
    if (node.type === 'sprite') return this.buildSprite(node)
    if (node.type === 'text') return this.buildText(node)
    if (node.type === 'camera') return this.buildCamera(node)
    if (node.type === 'path') return buildPath(node.path, this.meshColor)
    if (node.type === 'carved') return this.buildCarved(node)
    // A group is its transform and nothing else: an empty object others hang from.
    return new Object3D()
  }

  /**
   * A camera of the scene: the body one sees and clicks, and the frustum selection adds to it.
   *
   * The body hangs UNDER the camera, so it follows every move; the frustum hangs BESIDE it, in
   * the scene, like a light's helper — and that is not a preference. `CameraHelper` sets
   * `this.matrix = camera.matrixWorld` with `matrixAutoUpdate` off, so it places itself ON the
   * camera: made a child of it, that matrix applied TWICE and the outline was drawn at double
   * the camera's placement. A camera at (0, 2, 6) had its frustum floating at (0, 4, 12), which
   * is what a selection looked like until Alban pointed at it.
   *
   * The body carries no name of its own, so a click on it walks up to the camera's id.
   */
  private buildCamera(node: SceneNode & { type: 'camera' }): Object3D {
    const camera = new PerspectiveCamera(node.camera.fov, 1, node.camera.near, node.camera.far)
    const helper = new CameraHelper(camera)
    this.viewport.scene.add(helper)
    const body = cameraBody(this.markerColor, this.markerEdge)
    camera.add(body)
    // Kept beside the light helpers, and for the same reason: the preview hides all of them on
    // every frame it draws, and finding them by walking each node's children would be a scan.
    this.frustums.set(node.id, helper)
    this.markers.set(node.id, body)
    return camera
  }

  /**
   * A solid cut out of other solids. Born wearing its BASE brush — the wall before the window —
   * because ADR-25 refuses an empty node: what the cut has not finished is shown uncut, never
   * missing.
   */
  private buildCarved(node: CarvedNode): Mesh {
    const material = new MeshStandardMaterial()
    applyMaterial(material, node.material, this.meshColor)
    applyNegative(material, this.negativeColor, isNegative(node))

    // The base brush AS THE RECIPE PLACES IT: its transform carries the matter's scale, so a
    // wall shown uncut while the worker runs is the size it will be once pierced.
    const mesh = new Mesh(uncutGeometry(node.carved), material)
    // The very slots a mesh gets: a solid wears the same descriptor, and without this its maps
    // are named by the document and loaded by nobody.
    const textures = createMaterialTextures(this.textureCache, mesh, material, () => this.redraw())
    textures.apply(node.material)
    this.textures.set(node.id, textures)

    void this.recut(node, mesh)

    return mesh
  }

  /**
   * The solid, cut again from whatever the node now says.
   *
   * The evaluator hands out one geometry per distinct graph, so the mesh must never dispose what
   * it is given — `release` is what frees it, and only once the last node lets go.
   */
  private async recut(node: CarvedNode, into: Mesh): Promise<void> {
    // Recorded BEFORE the await: `release` reads this to know a reference is out, so a node
    // deleted mid-cut is given back exactly once.
    this.cutting.add(node.id)
    const cut = await this.csg.acquire(node.carved)
    const held = this.cutting.delete(node.id)

    // The OBJECT and the RECIPE, never the node itself: any edit — a drag, a rename, a colour —
    // mints a fresh node while leaving `carved` the same, and comparing identity threw the cut
    // away for a solid that still wanted it. `buildModel` compares its holder the same way.
    const applied = this.applied.get(node.id)
    if (!cut || this.objects.get(node.id) !== into || applied?.type !== 'carved') {
      if (cut && held) this.csg.release(node.carved)
      return
    }
    if (applied.carved !== node.carved) {
      if (held) this.csg.release(node.carved)
      return
    }
    const object = into

    // The uncut brush this node was born wearing. Its OWN buffers — `buildCarved` bakes the
    // base transform into them, which a shared shape could never carry — so `freeGeometry` falls
    // through to disposing it, and only a cache that really lends it would say otherwise.
    this.freeGeometry(object.geometry)
    object.geometry = cut
    void this.bvh.accelerate(object)
    // Same reason as a model landing into a wireframe scene: the edges outline the shape that
    // was there before the cut arrived — the uncut brush — until they are built again.
    if (this.needsEdges()) this.applyDisplay(object)
    this.redraw()
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

    // Through the caches like every other shape, though a typed word is never one they lend:
    // the rule holds without an exception to remember, and neither answers for these buffers.
    this.freeGeometry(object.geometry)
    object.geometry = textGeometry(font, node.text)
    // Same reason as a model landing into a wireframe scene: the edges were built from the shape
    // that was there before the face arrived — an empty one at first, the previous words after an
    // edit — and outline a mesh that no longer exists until they are built again.
    if (this.needsEdges()) this.applyDisplay(object)
    this.redraw()
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
      const maps = createModelTextures(
        this.textureCache,
        holder,
        () => this.redraw(),
        () =>
          reportFailure(
            'scene.texture',
            assetId,
            new Error('this model carries no material a map can be written into'),
          ),
      )
      this.modelMaps.set(node.id, maps)
      this.options.onMaterials?.(node.id, maps.count())
      this.dressModel(node.id)

      // The clips come from the cached SOURCE rather than the clone: `Object3D.copy` does not
      // carry them, and a clip addresses its targets by name — so the source's drive any
      // instance built from it.
      this.animations.add(node.id, holder, clipsOf(source))
      if (applied.type === 'model') {
        this.animations.apply(node.id, applied.model.lanes ?? [])
        this.ensureBundled(node.id, applied.model.lanes ?? [])
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
      // which is a tick after the `apply` that asked for it. It is also what the scene now
      // OCCUPIES, so the lights are re-cut against a set that just grew by a whole model.
      this.markContentChanged()
      this.placementChanged = true
      this.tuneShadowsIfMoved()
      this.regroupInstances()
      this.reportStats()
      // Same reason, same place: what the file brought was not there when the mode was applied,
      // and a model landing into a wireframe scene would be the one thing still drawn shaded.
      if (this.needsEdges()) this.applyDisplay(holder)
      // A dense model is what makes a click cost a frame — measured in `scenePicking.bench.ts`.
      // Off the UI thread, and after the render: the viewport shows the file before the tree.
      this.redraw()
      // Reported rather than swallowed, and under a scope of its own: `reportFailure` says a
      // subject once per scope, so sharing `scene.model` would let a tree that failed swallow the
      // message of a load that fails later for the same asset — two failures nothing relates.
      void this.accelerate(holder).catch(error => reportFailure('scene.bvh', assetId, error))
    })

    return holder
  }

  /** Told once per skeleton, not per model: it is filed by what its bones ARE. */
  private learnRig(rig: Rig): void {
    const roles: Record<string, HumanoidRole> = {}
    for (const bone of rig.bones) if (bone.role) roles[bone.name] = bone.role
    if (Object.keys(roles).length === 0) return

    const profile = {
      signature: skeletonSignatureOf(rig.bones.map(bone => bone.name)),
      roles,
    }
    this.retarget.remember(profile)
    // Out to whoever keeps them: a mapping put right in one document is the same mapping the
    // next document of this project needs, and the port dies with the viewport.
    this.options.onProfile?.(profile)
  }

  /**
   * Loads whatever clips a model's blocks name that its own file did not bring, once each, and
   * lets go of the ones no block names any more. Called wherever lanes are applied: a block can
   * be dropped long after the file it plays on landed.
   */
  private ensureBundled(nodeId: string, lanes: readonly ClipLane[]): void {
    const held = this.bundled.get(nodeId) ?? new Map<string, string>()
    this.bundled.set(nodeId, held)
    const wanted = new Map(foreignClipsOf(lanes).map(clip => [clip.key, clip]))

    for (const clip of wanted.values()) {
      if (held.has(clip.key)) continue

      // Acquired HERE and not inside the adoption: released while the read is still in flight,
      // a reference taken afterwards would never be given back.
      held.set(clip.key, clip.url)
      void this.adopt(nodeId, clip, this.clipSources.acquire(clip.url))
    }
    for (const [key, url] of [...held]) {
      if (wanted.has(key)) continue

      held.delete(key)
      this.clipSources.release(url)
    }
  }

  /**
   * Replays a clip the model's own file never held on THIS model's skeleton, which is the whole
   * point: it was authored for a rig nobody here has.
   */
  private async adopt(nodeId: string, clip: ForeignClip, loading: Promise<Object3D | null>) {
    const holder = this.objects.get(nodeId)
    if (!holder) return

    try {
      // Nothing of the source ever enters the scene: a file dropped for its animation carries a
      // whole character with it, and only its skeleton is any use here.
      const source = await loading
      if (!source) return

      // The first clip and only it: one file IS one animation, however many it spells.
      const first = clipsOf(source)[0]
      if (!first) throw new Error('this file carries no animation')

      // Before the retarget and not after: it is the only moment both skeletons are in hand, and
      // it is what lets the screen say WHICH joint the motion has nothing to drive.
      this.options.onClipFit?.(nodeId, clip.key, retargetFitOf(holder, source))

      const adapted = (await this.retarget.adapt(holder, source, [first]))?.[0]
      if (!adapted || this.objects.get(nodeId) !== holder) return

      // Named by the studio, always: Tripo spells its only clip `NlaTrack` and Uthana's spells
      // nothing at all, and neither may reach the screen.
      adapted.name = clip.label
      this.animations.addClip(nodeId, clip.key, adapted)
      this.options.onClips?.(
        nodeId,
        this.animations.fileNamesOf(nodeId),
        this.animations.lengthsOf(nodeId),
      )
      this.redraw()
    } catch (error) {
      // Under a scope of its own: a failing animation must not swallow what a failing model says.
      reportFailure('scene.animation', clip.url, error)
    }
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

    this.redraw()
    if (failures.length > 0) throw failures[0]
  }

  private applyDisplay(object: Object3D): void {
    // The mode itself lands per pane, at render time; what an arriving object needs here is its
    // edges, which are geometry rather than a flag.
    applyWireOverlay(object, this.needsEdges(), this.wireMaterial, this.quadEdges)
  }

  /**
   * The reach only has to be read again when something MOVED. A selection moves nothing, and
   * `apply` runs on every state change. The settings call `tuneShadows` directly instead: a map
   * that was resized has to be rebuilt whether or not the set stands where it stood.
   */
  private tuneShadowsIfMoved(): void {
    if (!this.placementChanged) return
    this.tuneShadows()
    this.placementChanged = false
  }

  /** Every light at once, against a reach measured once. */
  private tuneShadows(): void {
    const size = shadowMapSizeFor(this.view.quality, this.view.shadowMapSize)
    const framed: Object3D[] = []
    for (const [id, object] of this.objects) {
      if (this.applied.get(id)?.type !== 'light') continue
      resizeShadowMap(object, size)
      if (needsShadowFrustum(object)) framed.push(object)
    }
    // The scene is walked only if some light would read the answer: a set lit by a hemisphere
    // and a point light has no box to size, and measuring it would be a pass for nothing.
    if (framed.length === 0) return

    const reach = this.measureShadowReach()
    for (const light of framed) fitShadowCamera(light, reach)
  }

  /**
   * How far the shadows have to reach: what the scene OCCUPIES, never the grid. The grid is a
   * FLOOR under the answer, so an empty scene still gets a frustum and the first mesh laid down
   * casts something.
   */
  private measureShadowReach(): number {
    const bounds = this.heldShadowBounds()
    if (bounds.isEmpty()) return this.view.gridSize

    const size = bounds.getSize(new ThreeVector3())
    // The diagonal, not the width: a sun comes in at an angle, and a frustum cut to the exact
    // width of the set clips the shadow its far corner throws across it.
    return Math.max(Math.max(size.x, size.z) * Math.SQRT2, this.view.gridSize)
  }

  /**
   * 🛑 Walked in FULL only when the content changed. Reading the box off every object on every
   * pass was 23.8 ms of the 38.7 one `apply` cost on 50 000 lit nodes — a whole frame budget
   * spent re-measuring a set that had moved by one node.
   *
   * A move grows the box and never shrinks it: a frustum too WIDE loses a little shadow
   * resolution, one too NARROW clips the shadow off. Bringing an object back from far away
   * therefore keeps the wider frustum until the next content change.
   */
  private heldShadowBounds(): Box3 {
    if (!this.shadowBounds) {
      this.shadowBounds = boundsOf(this.framedObjects())
      return this.shadowBounds
    }
    for (const id of this.movedNodes) {
      const object = this.objects.get(id)
      if (object && isFramed(this.applied.get(id)?.type ?? 'group')) {
        this.shadowBounds.expandByObject(object)
      }
    }
    return this.shadowBounds
  }

  private buildMesh(node: SceneNode & { type: 'mesh' }): Mesh {
    const material = new MeshStandardMaterial()
    applyMaterial(material, node.material, this.meshColor)
    applyNegative(material, this.negativeColor, isNegative(node))

    const mesh = new Mesh(this.shapes.acquire(node.geometry, node.material.tilesPerMetre), material)
    // A texture arrives long after the frame that asked for it: the render is requested again
    // when it lands, or the viewport would show the mesh untextured until something else moved.
    const textures = createMaterialTextures(this.textureCache, mesh, material, () => this.redraw())
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
    const texture = createSpriteTexture(this.textureCache, material, () => this.redraw())
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

    // Hung under the light so it travels with it, and so a click on it walks up to the light's
    // id. An ambient lamp gets one too: it is the only thing in the viewport that can select it.
    this.dressLight(node.id, light, node.light)
    return light
  }

  /**
   * Markers set right AFTER their nodes are hung: held at their own size whatever scale a node
   * carries, and — for a lamp — turned to where its light actually goes.
   *
   * A pass of its own, and not part of `syncNode`, because both readings walk the chain of
   * PARENTS: a node built during the sync hangs from the scene until `hangFromParent` moves it,
   * so posing it any earlier would answer against the place it no longer is.
   */
  private poseMarkers(nodes: readonly SceneNode[]): void {
    for (const node of nodes) {
      const marker = this.markers.get(node.id)
      if (!marker) continue

      holdMarkerSize(marker)
      if (node.type === 'light') aimLightMarker(marker, node.light)
    }
  }

  /** The body a lamp is drawn as, built from its descriptor and put in place of the last one. */
  private dressLight(id: string, light: Light, descriptor: LightDescriptor): void {
    const worn = this.markers.get(id)

    // Hung before the old one goes: freeing the last user of a material destroys its GL program,
    // and three would compile it again on the very next frame.
    const body = lightBody(descriptor, this.markerColor, this.markerEdge)
    light.add(body)
    this.markers.set(id, body)

    if (worn) {
      light.remove(worn)
      disposeTree(worn)
    }
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
    this.markContentChanged()
    this.placementChanged = true
    // Read before `applied` is emptied: the reference the cache holds is keyed by what the node
    // pointed at, and nothing else remembers it.
    const applied = this.applied.get(id)
    if (applied?.type === 'model') this.modelCache.release(applied.model.assetId)
    // Given back once: `recut` may still be in flight, and `cutting` is what says which of the
    // two owes the reference.
    // `has`, never `delete`: consuming the token here left `recut` believing the reference had
    // already been given back, and neither side ever returned it.
    if (applied?.type === 'carved' && !this.cutting.has(id)) this.csg.release(applied.carved)
    // Before the instance goes: a mixer holding actions keeps every bone of a released model
    // alive with it.
    this.animations.remove(id)
    // Its share of every animation file it played: the last node to let go frees the parse.
    for (const url of this.bundled.get(id)?.values() ?? []) this.clipSources.release(url)
    this.bundled.delete(id)
    this.unbindSkeleton(id)
    this.iks.delete(id)
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
      // find it to remove. And `unhang` rather than `removeFromParent`: see there.
      unhang(object)
      if (object instanceof Mesh) {
        this.freeGeometry(object.geometry)
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

    // The frustum stands in the SCENE, beside its camera rather than under it — see `buildCamera`
    // — so removing the node leaves it drawn over nothing until it is taken out by hand.
    const frustum = this.frustums.get(id)
    if (frustum) {
      this.viewport.scene.remove(frustum)
      frustum.dispose()
      this.frustums.delete(id)
    }

    // The body hangs under the node, so it goes with it — but nothing above frees what it is made
    // of: an ambient lamp draws no helper, and its whole shape would leak on every delete.
    const marker = this.markers.get(id)
    if (marker) disposeTree(marker)
    this.markers.delete(id)
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

    const knob = this.pickedKnob()
    if (knob) {
      // Translate only: a control point is a position, and rotating or scaling one would ask
      // the gizmo to write something the descriptor has no room for.
      if (this.mode === 'translate') gizmo.attach(knob)
      else gizmo.detach()
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
    this.layOnSurface()
    // A box that stayed behind while its object moved is a box that says nothing. Re-reading a
    // bounding box is cheap — building one is not, which is why this is not `refreshAids`.
    this.aids.refreshBoxes()
    // The move is only reported on release, so an instanced node would stand where the last
    // grouping left it for the whole gesture. `TransformControls` has already written the world
    // matrices this reads. The moved slots alone, never a regrouping: that costs 47.5 ms on
    // 40 000 nodes, which per pointer move is three dropped frames.
    this.instances.moved(this.selectedIds, id => this.objects.get(id))
    this.redraw()
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

    const point = this.pickedPathPoint
    const knob = this.pickedKnob()
    if (point && knob) {
      // The knob's own position IS the control point: both live in the rail's frame.
      this.options.onPathPoint?.(point.nodeId, point.index, plainVector(knob.position))
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

  /**
   * A hand has let go of a camera, and which camera decides where it is written: a locked pane
   * edits the DOCUMENT, every other one moves the view, which is session state.
   */
  private reportCameraSettled(pane: number): void {
    // Pane 0 draws with the viewport's own camera whatever its view says — it can be lent none,
    // so an orbit there moves the VIEW even where a camera was picked for it.
    const view = pane === 0 ? 'free' : this.paneViews[pane]
    const object = isCameraView(view) ? this.cameraObject(view.nodeId) : null

    if (isCameraView(view) && object) {
      this.options.onCameraMoved?.(view.nodeId, transformOf(object))
      return
    }
    if (pane === 0) this.options.onView?.(this.viewPlacement())
  }

  /** Aims the gizmo at a bone, or lets go of the one it held. */
  setPickedBone(picked: { nodeId: string; bone: string } | null): void {
    this.pickedBone = picked
    this.attachGizmo()
    this.redraw()
  }

  /**
   * Aims the gizmo at one control point of a rail, or lets go of it.
   *
   * A point is not a node, exactly as a bone is not: it has no id in the document, cannot be
   * renamed, hidden or deleted on its own. `LightDescriptor` says why that matters — a node
   * nobody can rename is a property that leaked into the tree.
   */
  setPickedPathPoint(picked: { nodeId: string; index: number } | null): void {
    this.pickedPathPoint = picked
    this.attachGizmo()
    this.redraw()
  }

  /**
   * The knob of the point picked, while one is picked and its rail is still being worked on.
   *
   * The rail matters as much as the knob: a point is let go of by a click in the VIEWPORT, and
   * the tree selects through another door entirely — without this the gizmo stayed on a knob the
   * selection had hidden, while the object just picked in the tree got none.
   */
  private pickedKnob(): Object3D | null {
    const picked = this.pickedPathPoint
    if (!picked || !this.workedRailIds().has(picked.nodeId)) return null
    return this.objects.get(picked.nodeId)?.getObjectByName(knobName(picked.index)) ?? null
  }

  /** Redraws nodes from what was last applied, undoing what a gesture moved without meaning to. */
  private resync(moves: readonly NodeMove[]): void {
    const back: SceneNode[] = []
    for (const move of moves) {
      const node = this.applied.get(move.id)
      if (!node) continue
      this.applied.delete(move.id)
      this.syncNode(node)
      back.push(node)
    }
    this.poseMarkers(back)
    this.redraw()
  }

  /**
   * Read back from what is TRUE rather than left to the events that turn it on: a release
   * swallowed by a native menu, or a drag ended off the window, would leave the views frozen for
   * good, and a frozen viewport picks with the camera of a pane one has left — nothing selects.
   */
  private syncPaneFreeze(): void {
    // `flownWith === 2`, not `flying`: a flight under the LEFT button is orbiting at the same
    // time, and freezing would take that orbit away — see `startFlight`. The armed mode DOES
    // freeze: `OrbitControls.update()` ends on `lookAt(target)` and would undo every turn.
    this.viewport.freezePanes(
      this.gizmo?.dragging === true || this.flownWith === 2 || this.navigating,
    )
  }

  private readonly onPointerAim = (event: PointerEvent): void => {
    // A drag nobody holds any more. `TransformControls.pointerUp` returns before clearing
    // `dragging` unless the button released is the LEFT one, so a right click mid-drag — the fly
    // camera's own button — leaves it set for good, and the views frozen with it. No button down
    // is the one reading that cannot lie; clearing it dispatches, so the freeze lifts by itself.
    if (event.buttons === 0 && this.gizmo?.dragging) this.gizmo.dragging = false

    // Any movement repairs a freeze that outlived its gesture.
    this.syncPaneFreeze()
    this.aimGizmo()
    // The store settles for itself whether this is news — see `setActivePane`.
    this.options.onPane?.(this.viewport.activePane)
  }

  private startFlight(event: PointerEvent): void {
    this.flownFrom = { x: event.clientX, y: event.clientY }
    this.flownWith = event.button
    this.flew = false
    // The RIGHT button only. `freezePanes` ends in `armOrbits(null)`, which sets
    // `controls.enabled = false` on the main orbit — freezing under the left button would cost
    // that button the rotation it is held down for.
    if (event.button === 2) this.viewport.freezePanes(true)
    // Before the first frame of the flight, or its opening step spans the whole idle time.
    this.viewport.resetClock()
    this.redraw()
  }

  /** `buttons === 0` is the reading that cannot lie: pressing both and letting go out of order
   * would otherwise leave a flight armed under a hand that holds nothing. */
  private endFlight(button: number, event: PointerEvent): void {
    if (this.flownWith !== button && event.buttons !== 0) return

    const froze = this.flownWith === 2
    this.flownFrom = null
    this.flownWith = null
    // Not while the mode is armed: it owns the keys with no button down, and a click that ends
    // this button's flight would stop a camera whose `W` is still physically held — `useShortcuts`
    // pushes nothing again until the next key transition.
    if (!this.navigating) this.held.clear()
    // Only what froze thaws: the left button never froze anything, and thawing would re-arm the
    // orbits it never took. Asked rather than asserted, a handle may still be held under it.
    if (froze) this.syncPaneFreeze()
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button === 2) {
      this.startFlight(event)
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
    // ADDED to the left button, never substituted for what it already did: it goes on orbiting
    // through `OrbitControls` and picking on release, and only gains the keys.
    this.startFlight(event)
  }

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.button === 2) {
      // A right button that never flew and never moved was a click, not a flight: that is the
      // one gesture left for a menu in this viewport, the button itself being taken by the fly
      // camera.
      const still = !this.flew && this.held.size === 0 && wasClick(this.flownFrom, event)

      this.endFlight(2, event)

      // Never in pose mode: there a click names a bone, and a bone is not a node the menu could
      // act on. And never through the preview, for the reason the left button gives below: it is
      // drawn through another camera, so a ray cast from the pane underneath names whatever the
      // picture happens to be covering.
      if (still && !this.poseMode && !this.viewport.insetHasPointer(event)) {
        // A knob raises the menu of its POINT, and picks it on the way: what the menu acts on is
        // then what the gizmo holds, rather than two different things under one pointer.
        const knob = this.pathPointAt(event)
        if (knob) {
          this.options.onSelectPathPoint?.(knob)
          this.options.onPathPointMenu?.(knob.nodeId, knob.index)
          return
        }

        this.options.onContextMenu?.(this.nodeAt(event) ?? null)
      }
      return
    }
    if (event.button !== 0) return

    const pressed = this.pressed
    const flew = this.flew
    this.pressed = null
    this.endFlight(0, event)
    // A flight that moved the camera is not a click, even when the pointer never left its pixel:
    // the keyboard did the moving. The same reading the right button already makes for its menu.
    if (flew || !wasClick(pressed, event)) return
    // A click in the preview picks nothing: it is drawn through another camera, so a ray cast
    // from the pane underneath would select whatever the picture happens to be covering.
    if (this.viewport.insetHasPointer(event)) return

    this.aimGizmo()

    // In pose mode a click names a BONE and never a node: the two are exclusive, which is what
    // keeps a rig's bones from stealing every click meant for the mesh they drive.
    if (this.poseMode) {
      const ndc = this.viewport.pointerNdcOf(event)
      if (!ndc) return

      // The camera of the view under the pointer, never the main one — `nodeAt` says why.
      const picked = nearestProjected(this.projectedBones(this.cameraInHand()), {
        x: ndc.x,
        y: ndc.y,
      })
      this.options.onSelectBone?.(picked ? { nodeId: picked.nodeId, bone: picked.bone } : null)
      return
    }

    // Alt AND shift lays a point at the end of the rail, wherever the pointer is — the gesture
    // that draws a trajectory click by click. Tested before the knobs and before the line, or
    // whatever the pointer happened to be over would take the click out of a run of them.
    // The pair is RESERVED, so a click that lays no point lays nothing else either: falling
    // through would insert on the line under it, or toggle the selection mid-trajectory.
    if (event.altKey && event.shiftKey) {
      const spot = this.railSpotAt(event)
      if (spot) this.options.onAppendPathPoint?.(spot.nodeId, spot.point)
      return
    }

    // A knob of a rail already selected names a POINT, not the rail again: that is the one way
    // to reach a sub-element the tree has no row for.
    const knob = this.pathPointAt(event)
    if (knob) {
      this.options.onSelectPathPoint?.(knob)
      return
    }

    // Alt on the LINE of a selected rail poses a point in the stretch it was clicked on. Alt
    // rather than a plain click, which still has to be able to pick what stands behind the rail.
    if (event.altKey) {
      const spot = this.pathSegmentAt(event)
      if (spot) {
        this.options.onAddPathPoint?.(spot.nodeId, spot.index)
        return
      }
    }

    // Either modifier adds and removes: a viewport draws no rows, so it has no range to extend.
    const extending = event.shiftKey || event.metaKey || event.ctrlKey
    const id = this.nodeAt(event)
    this.options.onSelect(id ? [id] : [], extending ? 'toggle' : 'replace')
    // Whatever was picked before belongs to a rail that may no longer be the selection.
    if (this.pickedPathPoint) this.options.onSelectPathPoint?.(null)
  }

  /**
   * The control point the pointer is over, on a rail being WORKED ON — otherwise the knobs of
   * every rail would take clicks meant for what stands behind them.
   *
   * On the SCREEN rather than through a ray, for the reason `nearestProjected` carries: a knob
   * keeps its size on screen, and its world radius is whatever the last camera to draw it left
   * behind. A ray answered with that one, so in a quad view a knob could be unreachable where it
   * was plainly visible. It also settles what a ray never could — the curve lies right across
   * its own control points, so the nearest INTERSECTION was often the line.
   */
  private pathPointAt(event: PointerEvent): { nodeId: string; index: number } | null {
    const ndc = this.viewport.pointerNdcOf(event)
    if (!ndc) return null

    const picked = nearestProjected(
      this.projectedKnobs(this.cameraInHand()),
      { x: ndc.x, y: ndc.y },
      KNOB_REACH,
    )
    return picked ? { nodeId: picked.nodeId, index: picked.index } : null
  }

  /** Every knob of every rail being worked on, as the screen sees it. */
  private projectedKnobs(camera: Camera): ProjectedKnob[] {
    const projected: ProjectedKnob[] = []

    for (const rail of this.workedRails()) {
      for (const knob of rail.children) {
        const index = knobIndexOf(knob.name)
        if (index === null) continue

        knob.getWorldPosition(RAIL_SPOT)
        RAIL_SPOT.project(camera)
        projected.push({ nodeId: rail.name, index, x: RAIL_SPOT.x, y: RAIL_SPOT.y, z: RAIL_SPOT.z })
      }
    }

    return projected
  }

  /**
   * The stretch of rail the pointer is over, as an index into its control points: the point a
   * click poses goes right after it.
   *
   * The line is sampled by arc length, so the vertex three hands back IS an abscissa — which is
   * what `segmentAt` converts back into a stretch. Knobs are picked on the screen instead, so a
   * ray is now cast for the CURVE alone.
   *
   * The grab around that curve is set per rail and never left at three's own: its default is one
   * WORLD UNIT, which on a rail five units long is a tube wide enough to swallow clicks meant for
   * whatever stands beside it — and ⌥ writes a point into the document. Put back afterwards, the
   * raycaster being the one every other pick goes through: a light is picked by the LINES of its
   * helper. Measured from the rail's own origin rather than from where the ray lands, the point
   * not being known before the hit.
   */
  private pathSegmentAt(event: PointerEvent): { nodeId: string; index: number } | null {
    const ndc = this.viewport.pointerNdcOf(event)
    if (!ndc) return null

    this.pointer.set(ndc.x, ndc.y)
    const camera = this.cameraInHand()
    this.raycaster.setFromCamera(this.pointer, camera)

    const nearest = withHeldFuzz(this.raycaster, () => {
      let found: Intersection | null = null

      for (const rail of this.workedRails()) {
        this.raycaster.params.Line.threshold = screenScale(
          camera,
          rail.getWorldPosition(RAIL_SPOT),
          LINE_GRAB,
        )
        for (const hit of this.raycaster.intersectObject(rail, true)) {
          if (hit.object.name !== PATH_CURVE_NAME || hit.index === undefined) continue
          if (!found || hit.distance < found.distance) found = hit
        }
      }

      return found
    })
    if (!nearest || nearest.index === undefined) return null

    const nodeId = nearest.object.parent?.name
    const node = nodeId ? this.applied.get(nodeId) : null
    if (!nodeId || node?.type !== 'path') return null

    // The MIDDLE of the sample three hands back: `index` names where the segment starts, so
    // reading it straight puts a click in the last sixty-fourth before a control point into the
    // stretch before it.
    return { nodeId, index: segmentAt(node.path, (nearest.index + 0.5) / PATH_SAMPLES) }
  }

  /**
   * Where a click lands on the ONE rail being worked on, in that rail's own frame.
   *
   * Nothing for a pointer with two rails under it: extending whichever came first would pose a
   * point on a rail nobody aimed at, and a gesture repeated ten times would scatter half of them.
   */
  private railSpotAt(event: PointerEvent): { nodeId: string; point: PlainVector3 } | null {
    const worked = this.workedRailIds()
    if (worked.size !== 1) return null

    const [nodeId] = [...worked]
    const ndc = this.viewport.pointerNdcOf(event)
    if (!nodeId || !ndc) return null

    const rail = this.objects.get(nodeId)
    const node = this.applied.get(nodeId)
    const anchor = node?.type === 'path' ? node.path.points.at(-1) : null
    if (!rail || !anchor) return null

    const camera = this.cameraInHand()
    this.pointer.set(ndc.x, ndc.y)
    this.raycaster.setFromCamera(this.pointer, camera)

    // Up the chain, not down it: a rail parented to a group reads its own placement off that
    // group's matrix, and `updateMatrixWorld` would compose against whatever it last held.
    rail.updateWorldMatrix(true, false)
    RAIL_ANCHOR.copy(anchor)
    const spot =
      this.sceneryUnder() ??
      spotOnRay(
        this.raycaster.ray,
        rail.localToWorld(RAIL_ANCHOR),
        camera.getWorldDirection(RAIL_FACING),
      )
    if (!spot) return null

    return { nodeId, point: plainVector(rail.worldToLocal(spot)) }
  }

  /**
   * What the RAY IN HAND meets of the scenery — `railSpotAt` casts it. Nearest first, and the
   * nearest that a document point may sit ON: see `isScenery` for the three it walks past.
   *
   * No fuzz on lines or clouds either: a point aimed into the void must not land on the edges
   * hung under a camera as though they were a surface.
   */
  private sceneryUnder(): Vector3 | null {
    const hits = withHeldFuzz(this.raycaster, () => {
      this.raycaster.params.Line.threshold = 0
      this.raycaster.params.Points.threshold = 0
      return this.raycaster.intersectObjects([...this.objects.values()], true)
    })

    return (
      hits.find(hit => isScenery(hit.object, id => this.applied.get(id)?.type === 'path'))?.point ??
      null
    )
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
    // that the ray actually meets. Both they and the light carry the node's id. Only the ones on
    // SCREEN: three's raycaster does not read `visible`, so a hidden helper would go on catching
    // clicks over empty space and selecting a lamp nobody could see.
    // And what draws the grouped bodies, where that names a hit by its slot: the lots. Their
    // sources are met as well, on the layer instancing keeps them on, and answer the same.
    const targets = [
      ...this.objects.values(),
      ...[...this.helpers.values()].filter(helper => helper.visible),
      ...this.instances.pickable(),
    ]
    const hit = this.raycaster.intersectObjects(targets, true)[0]
    return hit
      ? (this.instances.nodeIdOf(hit) ?? nodeIdOf(hit.object, name => this.objects.has(name)))
      : null
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

  /**
   * On the way IN to an axis, never on the way back to `null`: there is no plane to turn once
   * nothing is held, and this fires on both edges — half the walks would be for no one.
   */
  private readonly onGizmoAxisChanged = (): void => {
    if (this.gizmo?.axis) this.refreshGizmoMatrices()
  }

  // No need for the event's own value: three writes the property before it dispatches.
  private readonly onDraggingChanged = (): void => {
    // A handle taken under the left button ends the flight that button armed: dragging a gizmo
    // and flying at once would move the camera and the object on one gesture.
    if (this.gizmo?.dragging === true) {
      // Before the branch below, and outside it: a surface snap composes its turn onto this one
      // every frame, so it has to be the one the gesture STARTED on whether or not a flight was
      // running.
      if (this.gizmo?.object) this.surfaceHeld.copy(this.gizmo.object.quaternion)
      if (this.flownWith === 0) {
        this.flownFrom = null
        this.flownWith = null
        if (!this.navigating) this.held.clear()
      }
    }
    this.syncPaneFreeze()
  }

  /** Reports whether the camera is still flying, which is what keeps the loop alive. */
  private advance(delta: number): boolean {
    // Before the panes are drawn and after everything that writes a pose — the head, a clip, a
    // gizmo on the handle: whatever moved, the chain reaches for where the target stands NOW.
    for (const chain of this.iks.values()) chain.update()
    // After the chains, never before: the joints have to show where the bones ENDED UP.
    for (const joints of this.joints.values()) {
      if (joints.points.visible) joints.refresh()
    }

    // Before the panes are drawn: the cap reads the distance, and the distance moves on every
    // notch of the wheel. Read on `configure` alone it was right once, then stayed put.
    this.applyGizmoSize()

    const moving = this.flying && this.held.size > 0
    if (moving) {
      // Remembered rather than read back at the release: the keys are let go of first, and the
      // release would then look exactly like a click — see `flew`.
      this.flew = true
      this.fly(delta)
    }
    // The clips do not appear here: they stand where the head put them, and the head is advanced
    // by `useAnimationPlayback`, which calls `setPlayhead` and asks for a frame of its own.
    return moving
  }

  private fly(delta: number): void {
    const camera = this.viewport.camera
    const boost = this.held.has('boost') ? this.view.boostFactor : 1
    const speed = this.flySpeed * delta * boost

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

/** Whether anything the drawn aids are built from moved — see `refreshAids`, which is not cheap. */
function aidsMoved(held: ViewportOptions, next: ViewportOptions): boolean {
  return (
    held.boundingBoxes !== next.boundingBoxes ||
    held.origins !== next.origins ||
    held.normals !== next.normals ||
    held.normalLength !== next.normalLength
  )
}

/** The two that only turn existing helpers on and off, which costs a flag apiece. */
function helperVisibilityMoved(held: ViewportOptions, next: ViewportOptions): boolean {
  return held.lightHelpers !== next.lightHelpers || held.cameraHelpers !== next.cameraHelpers
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
