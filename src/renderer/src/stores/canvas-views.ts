import { create } from 'zustand'
import type { CanvasSelection } from '@/engines/canvas/canvas-selection'
import {
  DEFAULT_VIEW,
  sameViewport,
  type CanvasView,
  type Viewport,
} from '@/engines/canvas/viewport'
import type { Size } from '@/engines/core/geometry'

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
  /**
   * The region carved out of each document. Here rather than in `CanvasState` for the same
   * reason as the viewport: a marquee is how one is looking at a document, not something one
   * made of it, and ⌘Z must not give one back.
   */
  selections: Record<string, CanvasSelection>
  setViewport: (documentId: string, viewport: Viewport) => void
  setHost: (documentId: string, size: Size) => void
  setSelection: (documentId: string, selection: CanvasSelection) => void
  toggle: (documentId: string, key: ViewToggle) => void
}

export const useCanvasViews = create<CanvasViewsState>()(set => ({
  views: {},
  hosts: {},
  selections: {},

  // Both guard on the value first: a wheel notch with no delta, a pan frame with no motion and a
  // resize observer firing for an unchanged layout would otherwise wake every subscriber.
  setViewport: (documentId, viewport) =>
    set(state => {
      const view = canvasViewOf(state, documentId)
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

  setSelection: (documentId, selection) =>
    set(state => ({ selections: { ...state.selections, [documentId]: selection } })),

  toggle: (documentId, key) =>
    set(state => {
      const view = canvasViewOf(state, documentId)
      return { views: { ...state.views, [documentId]: { ...view, [key]: !view[key] } } }
    }),
}))

type Readable = Pick<CanvasViewsState, 'views' | 'hosts' | 'selections'>

/** Shared defaults, never a fresh object: a selector building one hands React a new snapshot. */
export function canvasViewOf(state: Readable, documentId: string): CanvasView {
  return state.views[documentId] ?? DEFAULT_VIEW
}

export function hostOf(state: Readable, documentId: string): Size {
  return state.hosts[documentId] ?? NO_HOST
}

export function selectionOf(state: Readable, documentId: string): CanvasSelection {
  return state.selections[documentId] ?? null
}
