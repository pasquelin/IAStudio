import { create } from 'zustand'
import { DEFAULT_VIEW, sameViewport, type Viewport } from '@/engines/canvas/viewport'
import type { Size } from '@/engines/core/geometry'

const NO_HOST: Size = { width: 0, height: 0 }

/**
 * How each interface is being LOOKED at — pan and zoom, and how large the panel showing it is.
 *
 * A store of its own rather than a corner of `GuiState`: this is not something one made of the
 * document, so it is not saved with it and ⌘Z must never give a pan back. The host size is here
 * for the one reason the image editor keeps its own: a zoom from the toolbar has to hold the
 * middle of the panel still, and a command handler has no view of the DOM.
 */
export type GuiViewsState = {
  viewports: Record<string, Viewport>
  hosts: Record<string, Size>
  setViewport: (documentId: string, viewport: Viewport) => void
  setHost: (documentId: string, size: Size) => void
}

export const useGuiViews = create<GuiViewsState>()(set => ({
  viewports: {},
  hosts: {},

  // Both guard on the value first: a pan frame with no motion and a resize observer firing for
  // an unchanged layout would otherwise wake every subscriber.
  setViewport: (documentId, viewport) =>
    set(state =>
      sameViewport(guiViewportOf(state, documentId), viewport)
        ? state
        : { viewports: { ...state.viewports, [documentId]: viewport } },
    ),

  setHost: (documentId, size) =>
    set(state => {
      const host = guiHostOf(state, documentId)
      return host.width === size.width && host.height === size.height
        ? state
        : { hosts: { ...state.hosts, [documentId]: size } }
    }),
}))

type Readable = Pick<GuiViewsState, 'viewports' | 'hosts'>

export const guiViewportOf = (state: Readable, documentId: string): Viewport =>
  state.viewports[documentId] ?? DEFAULT_VIEW.viewport

export const guiHostOf = (state: Readable, documentId: string): Size =>
  state.hosts[documentId] ?? NO_HOST
