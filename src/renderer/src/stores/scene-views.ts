import { create } from 'zustand'
import type { DisplayMode } from '@/engines/scene/scene-view'
import type { ProjectionKind } from '@/engines/viewport/ViewportEngine'

export type SceneView = {
  projection: ProjectionKind
  display: DisplayMode
  /** Whether the bones of every rigged model are drawn over it. Off, like every other overlay. */
  skeletons: boolean
}

const DEFAULT_SCENE_VIEW: SceneView = {
  projection: 'perspective',
  display: 'shaded',
  skeletons: false,
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
  setDisplay: (documentId: string, display: DisplayMode) => void
  setSkeletons: (documentId: string, skeletons: boolean) => void
}

export const useSceneViews = create<SceneViewsState>()(set => ({
  views: {},

  setProjection: (documentId, projection) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), projection } },
    })),

  setDisplay: (documentId, display) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), display } },
    })),

  setSkeletons: (documentId, skeletons) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), skeletons } },
    })),
}))

/** A document nobody has looked at yet is looked at the default way. */
export function viewOf(state: SceneViewsState, documentId: string): SceneView {
  return state.views[documentId] ?? DEFAULT_SCENE_VIEW
}
