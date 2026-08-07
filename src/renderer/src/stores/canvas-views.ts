import { create } from 'zustand'
import {
  DEFAULT_VIEW,
  sameViewport,
  type CanvasView,
  type Size,
  type Viewport,
} from '@/engines/canvas/viewport'

/** The toggles a menu item flips. Spelled as a union so a typo cannot invent a fourth one. */
export type ViewToggle = 'rulers' | 'guides' | 'snap'

const NO_HOST: Size = { width: 0, height: 0 }

/**
 * How each image document is being looked at — pan, zoom, rulers, guides, magnetism. Session
 * state: it is not saved with the document and ⌘Z never touches it, which is why it is a store
 * of its own rather than a corner of `CanvasState`.
 *
 * The host size is here too, and only because the menu needs it: zooming from ⌘+ has to keep the
 * middle of the panel still, and a command handler has no view of the DOM.
 */
export type CanvasViewsState = {
  views: Record<string, CanvasView>
  hosts: Record<string, Size>
  setViewport: (documentId: string, viewport: Viewport) => void
  setHost: (documentId: string, size: Size) => void
  toggle: (documentId: string, key: ViewToggle) => void
}

export const useCanvasViews = create<CanvasViewsState>()(set => ({
  views: {},
  hosts: {},

  // Both guard on the value first: a wheel notch with no delta, a pan frame with no motion and a
  // resize observer firing for an unchanged layout would otherwise wake every subscriber.
  setViewport: (documentId, viewport) =>
    set(state => {
      const view = viewOf(state, documentId)
      return sameViewport(view.viewport, viewport)
        ? state
        : { views: { ...state.views, [documentId]: { ...view, viewport } } }
    }),

  setHost: (documentId, size) =>
    set(state => {
      const host = hostOf(state, documentId)
      return host.width === size.width && host.height === size.height
        ? state
        : { hosts: { ...state.hosts, [documentId]: size } }
    }),

  toggle: (documentId, key) =>
    set(state => {
      const view = viewOf(state, documentId)
      return { views: { ...state.views, [documentId]: { ...view, [key]: !view[key] } } }
    }),
}))

type Readable = Pick<CanvasViewsState, 'views' | 'hosts'>

/** Shared defaults, never a fresh object: a selector building one hands React a new snapshot. */
export function viewOf(state: Readable, documentId: string): CanvasView {
  return state.views[documentId] ?? DEFAULT_VIEW
}

export function hostOf(state: Readable, documentId: string): Size {
  return state.hosts[documentId] ?? NO_HOST
}
