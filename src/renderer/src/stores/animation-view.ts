import { create } from 'zustand'
import type { Us } from '@shared/domain/time'
import { keyId } from '@/engines/scene/animation-painter'
import type { Viewport } from '@/engines/timeline/timeline-geometry'
import { DEFAULT_VIEWPORT } from '@/engines/timeline/viewport'

/**
 * How each scene's animation band is being looked at, and what is picked in it.
 *
 * Outside the document for the same reasons the montage's viewport is: a zoom is not an edit and
 * has no business on the undo stack, and the panel is unmounted whenever the workspace leaves 3D.
 *
 * `autoKey` sits here rather than in the document because it says how one WORKS, not what one
 * made — the same rule that puts a track's armed flag outside the history.
 */
export type AnimationView = {
  viewport: Viewport
  /** Subjects whose channels are unfolded, by `subjectKey`. Absent means folded. */
  expanded: readonly string[]
  /** Picked keys, as `keyId(rowId, time)`. */
  selected: readonly string[]
  /** Whether moving an object writes a key rather than its rest pose. */
  autoKey: boolean
}

const DEFAULT_ANIMATION_VIEW: AnimationView = {
  viewport: DEFAULT_VIEWPORT,
  expanded: [],
  selected: [],
  autoKey: false,
}

export type AnimationViewState = {
  views: Record<string, AnimationView>
  setViewport: (documentId: string, viewport: Viewport) => void
  toggleExpanded: (documentId: string, subjectId: string) => void
  setSelected: (documentId: string, selected: readonly string[]) => void
  setAutoKey: (documentId: string, autoKey: boolean) => void
  forget: (documentId: string) => void
}

export const useAnimationViews = create<AnimationViewState>()(set => ({
  views: {},

  setViewport: (documentId, viewport) =>
    set(state => write(state, documentId, view => ({ ...view, viewport }))),

  toggleExpanded: (documentId, subjectId) =>
    set(state =>
      write(state, documentId, view => ({
        ...view,
        expanded: view.expanded.includes(subjectId)
          ? view.expanded.filter(held => held !== subjectId)
          : [...view.expanded, subjectId],
      })),
    ),

  setSelected: (documentId, selected) =>
    set(state => write(state, documentId, view => ({ ...view, selected }))),

  setAutoKey: (documentId, autoKey) =>
    set(state => write(state, documentId, view => ({ ...view, autoKey }))),

  forget: documentId =>
    set(state => {
      const { [documentId]: gone, ...views } = state.views
      void gone
      return { views }
    }),
}))

function write(
  state: Pick<AnimationViewState, 'views'>,
  documentId: string,
  change: (view: AnimationView) => AnimationView,
): Pick<AnimationViewState, 'views'> {
  return { views: { ...state.views, [documentId]: change(animationViewOf(state, documentId)) } }
}

/** A document nobody has looked at yet is looked at the default way. */
export function animationViewOf(
  state: Pick<AnimationViewState, 'views'>,
  documentId: string,
): AnimationView {
  return state.views[documentId] ?? DEFAULT_ANIMATION_VIEW
}

/**
 * The picked keys as a set, for the paint and the hit test to ask in one step.
 *
 * NOT a zustand selector, and it must not become one: a fresh Set per call is a new snapshot on
 * every render, and the subscription then never settles — the trap `model-clips` carries a note
 * about. Callers wrap it in a `useMemo` keyed on the array, whose identity IS stable.
 */
export function keySetOf(keys: readonly string[]): ReadonlySet<string> {
  return new Set(keys)
}

/** How a picked key is named, so a caller never composes the id by hand. */
export function selectionId(rowId: string, time: Us): string {
  return keyId(rowId, time)
}
