import { create } from 'zustand'
import type { DisplayMode } from '@/engines/scene/scene-view'
import type { ProjectionKind } from '@/engines/viewport/ViewportEngine'

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
  /** Four views instead of one — top, front, left, and the one being flown. */
  quad: boolean
  /** Where the animation head stands, in seconds. Never in the document — see `AnimationTimeline`. */
  playhead: number
  playing: boolean
}

const DEFAULT_SCENE_VIEW: SceneView = {
  projection: 'perspective',
  displays: ['shaded'],
  skeletons: false,
  quad: false,
  playhead: 0,
  playing: false,
}

/**
 * How each scene document is being looked at. Session state, exactly like `canvas-views` for an
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
  setQuad: (documentId: string, quad: boolean) => void
  setPlayhead: (documentId: string, playhead: number) => void
  setPlaying: (documentId: string, playing: boolean) => void
}

export const useSceneViews = create<SceneViewsState>()(set => ({
  views: {},

  setProjection: (documentId, projection) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), projection } },
    })),

  setDisplay: (documentId, pane, display) =>
    set(state => {
      const view = viewOf(state, documentId)
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
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), skeletons } },
    })),

  setQuad: (documentId, quad) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), quad } },
    })),

  setPlayhead: (documentId, playhead) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), playhead } },
    })),

  setPlaying: (documentId, playing) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), playing } },
    })),
}))

/** How a given view draws. A pane nobody has set draws the way the studio opens: shaded. */
export function displayOfPane(displays: readonly DisplayMode[], pane: number): DisplayMode {
  return displays[pane] ?? 'shaded'
}

/** A document nobody has looked at yet is looked at the default way. */
export function viewOf(state: SceneViewsState, documentId: string): SceneView {
  return state.views[documentId] ?? DEFAULT_SCENE_VIEW
}
