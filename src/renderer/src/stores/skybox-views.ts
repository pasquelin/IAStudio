import { create } from 'zustand'
import { DEFAULT_FIELD_OF_VIEW, SKYBOX_VIEWS, type SkyboxView } from '@shared/domain/skybox'

/**
 * How each sky is being LOOKED AT right now — which projection, how wide the lens, whether the
 * test objects stand in it.
 *
 * Session state, exactly as `canvas-views` is: none of it is saved with the document and ⌘Z
 * never touches it. It lives in a store rather than in the document component because the panel
 * that offers these controls is not inside that component — a viewport has no room for a menu.
 */
export type SkyboxViewState = {
  view: SkyboxView
  fieldOfView: number
  /** A sky is judged by what it lights, not by its own picture, so the probes start on. */
  probes: boolean
}

export const DEFAULT_SKYBOX_VIEW: SkyboxViewState = {
  view: 'immersive',
  fieldOfView: DEFAULT_FIELD_OF_VIEW,
  probes: true,
}

export type SkyboxViewsState = {
  views: Record<string, SkyboxViewState>
  set: (documentId: string, patch: Partial<SkyboxViewState>) => void
  /** Cycles the projection: four modes, and a key each would spend four letters on one space. */
  cycleView: (documentId: string) => void
  forget: (documentId: string) => void
}

export const useSkyboxViews = create<SkyboxViewsState>()((set, get) => ({
  views: {},

  set: (documentId, patch) =>
    set(state => ({
      views: { ...state.views, [documentId]: { ...viewOf(state, documentId), ...patch } },
    })),

  cycleView: documentId => {
    const current = viewOf(get(), documentId).view
    const next = SKYBOX_VIEWS.indexOf(current) + 1
    get().set(documentId, { view: SKYBOX_VIEWS[next % SKYBOX_VIEWS.length] ?? current })
  },

  // Called when a document closes: a record per document that never leaves is a leak the length
  // of a session, and a reopened id would come back to the view its predecessor left behind.
  forget: documentId =>
    set(state => {
      const { [documentId]: gone, ...rest } = state.views
      return gone ? { views: rest } : state
    }),
}))

/**
 * The same object for a document nobody has touched, never a fresh one: a selector that built
 * its default per call would hand React a new snapshot on every render.
 */
export function viewOf(state: SkyboxViewsState, documentId: string): SkyboxViewState {
  return state.views[documentId] ?? DEFAULT_SKYBOX_VIEW
}
