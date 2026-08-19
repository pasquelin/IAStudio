import { create } from 'zustand'
import type { Us } from '@shared/domain/time'
import {
  DEFAULT_PANE_VIEWS,
  type CameraPlacement,
  type PaneView,
  type PreviewWatch,
} from '@/engines/scene/sceneView'
import { type ClipRef, type DisplayMode } from '@shared/domain/scene'
import { NOTHING_ISOLATED, type Isolation } from '@/engines/scene/isolation'
import type { ProjectionKind } from '@/engines/viewport/ViewportEngine'

/**
 * What the engine needs to watch a block, plus the very block the animations panel laid to watch
 * it — `laid` only when that panel is the one that laid it, and the engine never reads it.
 *
 * In the SAME object rather than beside it, so nothing can drop one half: `setPlayhead` and
 * `setPlaying` end a preview by writing `null`, and an ownership that outlived that write would
 * hand back the very block an interruption is meant to keep. Held as the REF and compared by
 * identity, so a block the band has since moved or trimmed is work, no longer a try.
 */
export type WatchedPreview = PreviewWatch & { laid?: ClipRef }

export type SceneView = {
  projection: ProjectionKind
  /**
   * One mode per view, main one first. A list rather than a single value: in a quad layout each
   * view answers for itself — wireframe on top while the flown one stays shaded is the whole
   * point of four views.
   */
  displays: readonly DisplayMode[]
  /** Whether the bones of every rigged model are drawn over it. Off, like every other overlay. */
  skeletons: boolean
  /** Whether a click picks a bone rather than a mesh. Exclusive on purpose — see the renderer. */
  poseMode: boolean
  /** The bone the pose mode picked, which the gizmo holds. Never a node — see `TrackTarget`. */
  pickedBone: { nodeId: string; bone: string } | null
  /** The control point of a rail the gizmo holds. Never a node either — see `PathDescriptor`. */
  pickedPathPoint: { nodeId: string; index: number } | null
  /** Four views instead of one — top, front, left, and the one being flown. */
  quad: boolean
  /** Whether the wireframe drops its triangulation diagonals. Never real quads — see the engine. */
  quadEdges: boolean
  /**
   * Whether a drag advances in steps. HOW COARSE those steps are is a preference of the person;
   * whether they apply at all is a way of working on this document at this moment, which is why
   * the two live apart.
   *
   * Here rather than in the viewport's own state because two surfaces toggle it — the toolbar
   * and the Environment panel — and a `useState` inside the viewport is unreachable from a dock.
   */
  snapping: boolean
  /**
   * What the VIEWPORT is hiding — an isolation, and nodes hidden by hand.
   *
   * Session state and nothing else: `SceneNode.visible` is the document's own answer, saved and
   * undone, and leaving an isolation must give back exactly what went in. See `isolation.ts`.
   */
  isolation: Isolation
  /**
   * How big the camera preview is drawn. It opens by itself on a camera being selected and
   * closes with that selection, so there is no third value: what it shows is never a question.
   */
  previewSize: 'inset' | 'full'
  /**
   * How far the preview has been dragged from the corner it opens in, in CSS pixels. Session
   * state like the rest: where somebody pushed a window aside to see under it is not the scene.
   */
  previewOffset: { x: number; y: number }
  /** What each of the four views shows. Only a free one turns — see `PaneView`. */
  panes: readonly PaneView[]
  /**
   * Which of the four the pointer last settled in. Held here rather than read off the engine:
   * a panel that asked the engine during its render was never told when the answer changed, and
   * wrote a display mode into the pane the hand had already left.
   */
  activePane: number
  /** Where the animation head stands, in microseconds. Never in the document — see `AnimationTimeline`. */
  playhead: Us
  /**
   * Whether the head runs on. The ONE clock of a scene: the inspector's play button writes here
   * too, so a clip watched in the viewport and the band under it can never disagree.
   */
  playing: boolean
  /**
   * The block being watched on its own clock, by node and by block id, or nothing.
   *
   * Deliberately NOT the head: watching one animation is a look at a block, not a move of the
   * scene's clock, and the band must stay where it was left. Moving the head drops it — two
   * clocks driving one model is the one thing that would make a render disagree with the screen.
   */
  preview: WatchedPreview | null
  /**
   * Where the free camera of the 3D tab stands, published once a drag of it settles.
   *
   * It is here so a MONTAGE can look through it: a scene with no camera of its own is drawn
   * from what the person building it is looking at, which is the one framing they have actually
   * chosen. Null until that tab has been opened and moved — the montage then frames the
   * contents by itself.
   *
   * Session state like the rest of this view, so orbiting never marks a document modified and
   * ⌘Z never gives a camera move back. The price is that closing the 3D tab forgets it.
   */
  camera: CameraPlacement | null
}

const DEFAULT_SCENE_VIEW: SceneView = {
  projection: 'perspective',
  displays: ['shaded'],
  skeletons: false,
  poseMode: false,
  pickedBone: null,
  pickedPathPoint: null,
  quad: false,
  quadEdges: false,
  snapping: false,
  isolation: NOTHING_ISOLATED,
  previewSize: 'inset',
  previewOffset: { x: 0, y: 0 },
  panes: DEFAULT_PANE_VIEWS,
  activePane: 0,
  playhead: 0,
  playing: false,
  preview: null,
  camera: null,
}

/**
 * How each scene document is being looked at. Session state, exactly like `canvasViews` for an
 * image: switching to an orthographic camera or to wireframe changes nothing of the scene, so it
 * is neither saved with the document nor undone by ⌘Z — which is why it is a store of its own
 * rather than a corner of `SceneState`.
 *
 * Per document, not per application: two scenes open side by side are two points of view.
 */
export type SceneViewsState = {
  views: Record<string, SceneView>
  setProjection: (documentId: string, projection: ProjectionKind) => void
  setDisplay: (documentId: string, pane: number, display: DisplayMode) => void
  setSkeletons: (documentId: string, skeletons: boolean) => void
  setPoseMode: (documentId: string, poseMode: boolean) => void
  setPickedBone: (documentId: string, pickedBone: SceneView['pickedBone']) => void
  setPickedPathPoint: (documentId: string, pickedPathPoint: SceneView['pickedPathPoint']) => void
  setQuad: (documentId: string, quad: boolean) => void
  setQuadEdges: (documentId: string, quadEdges: boolean) => void
  setSceneSnapping: (documentId: string, snapping: boolean) => void
  setActivePane: (documentId: string, activePane: number) => void
  setSceneIsolation: (documentId: string, isolation: Isolation) => void
  setPreviewSize: (documentId: string, previewSize: SceneView['previewSize']) => void
  setPreviewOffset: (documentId: string, previewOffset: SceneView['previewOffset']) => void
  setPaneView: (documentId: string, pane: number, view: PaneView) => void
  setPlayhead: (documentId: string, playhead: Us) => void
  setPlaying: (documentId: string, playing: boolean) => void
  setPreview: (documentId: string, preview: SceneView['preview']) => void
  setCamera: (documentId: string, camera: CameraPlacement) => void
}

export const useSceneViews = create<SceneViewsState>()(set => ({
  views: {},

  setProjection: (documentId, projection) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), projection } },
    })),

  setDisplay: (documentId, pane, display) =>
    set(state => {
      const view = sceneViewOf(state, documentId)
      // Grown rather than indexed into: a view switched to four before anything set a mode has
      // one entry, and writing at index 3 would leave two holes reading as undefined.
      const displays = Array.from(
        { length: Math.max(view.displays.length, pane + 1) },
        (_, index) => (index === pane ? display : (view.displays[index] ?? 'shaded')),
      )
      return { views: { ...state.views, [documentId]: { ...view, displays } } }
    }),

  setSkeletons: (documentId, skeletons) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), skeletons } },
    })),

  setPoseMode: (documentId, poseMode) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), poseMode } },
    })),

  setPickedBone: (documentId, pickedBone) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), pickedBone } },
    })),

  setPickedPathPoint: (documentId, pickedPathPoint) =>
    set(state => ({
      views: {
        ...state.views,
        [documentId]: { ...sceneViewOf(state, documentId), pickedPathPoint },
      },
    })),

  setQuad: (documentId, quad) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), quad } },
    })),

  setQuadEdges: (documentId, quadEdges) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), quadEdges } },
    })),

  setSceneSnapping: (documentId, snapping) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), snapping } },
    })),

  setActivePane: (documentId, activePane) =>
    set(state => {
      // Written on every pointer move that settles a pane: an unchanged value must not hand
      // React a new snapshot, or the inspector re-renders across the whole viewport.
      const view = sceneViewOf(state, documentId)
      if (view.activePane === activePane) return state
      return { views: { ...state.views, [documentId]: { ...view, activePane } } }
    }),

  setSceneIsolation: (documentId, isolation) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), isolation } },
    })),

  setPreviewSize: (documentId, previewSize) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), previewSize } },
    })),

  setPreviewOffset: (documentId, previewOffset) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...sceneViewOf(state, documentId), previewOffset } },
    })),

  setPaneView: (documentId, pane, view) =>
    set(state => {
      const current = sceneViewOf(state, documentId)
      const panes = current.panes.map((held, index) => (index === pane ? view : held))
      return { views: { ...state.views, [documentId]: { ...current, panes } } }
    }),

  // Moving the head drops the preview: two clocks driving one model is what makes a render
  // disagree with the screen.
  setPlayhead: (documentId, playhead) =>
    set(state => ({
      views: {
        ...state.views,
        [documentId]: { ...sceneViewOf(state, documentId), playhead, preview: null },
      },
    })),

  setPlaying: (documentId, playing) =>
    set(state => ({
      views: {
        ...state.views,
        [documentId]: { ...sceneViewOf(state, documentId), playing, preview: null },
      },
    })),

  setPreview: (documentId, preview) =>
    set(state => ({
      views: {
        ...state.views,
        [documentId]: { ...sceneViewOf(state, documentId), preview, playing: false },
      },
    })),

  setCamera: (documentId, camera) =>
    set(state => {
      // Written only when it actually moved: this lands at the end of every orbit, and a store
      // waking every reader of the scene for an identical placement would repaint the montage
      // for nothing.
      const view = sceneViewOf(state, documentId)
      if (samePlacement(view.camera, camera)) return state
      return { views: { ...state.views, [documentId]: { ...view, camera } } }
    }),
}))

function samePlacement(left: CameraPlacement | null, right: CameraPlacement): boolean {
  if (!left) return false
  return (
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.position.z === right.position.z &&
    left.target.x === right.target.x &&
    left.target.y === right.target.y &&
    left.target.z === right.target.z
  )
}

/** How a given view draws. A pane nobody has set draws the way the studio opens: shaded. */
export function displayOfPane(displays: readonly DisplayMode[], pane: number): DisplayMode {
  return displays[pane] ?? 'shaded'
}

/** A document nobody has looked at yet is looked at the default way. */
export function sceneViewOf(state: SceneViewsState, documentId: string): SceneView {
  return state.views[documentId] ?? DEFAULT_SCENE_VIEW
}
