import { create } from 'zustand'
import type { Viewport } from '@/engines/timeline/timelineGeometry'
import { DEFAULT_VIEWPORT } from '@/engines/timeline/viewport'

type TimelineViewState = {
  viewports: Record<string, Viewport>
  set: (documentId: string, viewport: Viewport) => void
}

/**
 * Where each sequence is being looked at: zoom, horizontal offset, vertical scroll.
 *
 * Outside the document state on purpose. Two reasons, and both are load-bearing: a view change
 * is not an edit and has no business on the undo stack, and the timeline panel is unmounted
 * whenever the workspace leaves Video — a zoom held in the component would be lost on every
 * round trip.
 *
 * Not persisted: it is session state, like which tab is in front.
 */
export const useTimelineView = create<TimelineViewState>()(set => ({
  viewports: {},

  set: (documentId, viewport) =>
    set(state => ({ viewports: { ...state.viewports, [documentId]: viewport } })),
}))

export function viewportOf(
  state: Pick<TimelineViewState, 'viewports'>,
  documentId: string,
): Viewport {
  return state.viewports[documentId] ?? DEFAULT_VIEWPORT
}
