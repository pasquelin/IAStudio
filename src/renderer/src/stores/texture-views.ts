import { create } from 'zustand'
import type { PbrChannel } from '@shared/domain/texture'

/**
 * Which channel of each texture is being looked at on its own, or `null` for the lit material.
 *
 * Session state, and a store of its own for the reason `useCanvasViews` gives: how one is looking
 * at a document is not something one made of it. Inspecting a normal map flat must not travel in
 * the `.tex`, and ⌘Z must not give the sphere back.
 */
export type TextureViewsState = {
  inspected: Record<string, PbrChannel | null>
  inspect: (documentId: string, channel: PbrChannel | null) => void
  /** Dropped on close: the project folder hands ids out again, and a document reopened later must
   * not open on the flat view of the one before it. */
  forget: (documentId: string) => void
}

export const useTextureViews = create<TextureViewsState>()(set => ({
  inspected: {},
  inspect: (documentId, channel) =>
    set(state => ({ inspected: { ...state.inspected, [documentId]: channel } })),
  forget: documentId =>
    set(state => {
      if (!(documentId in state.inspected)) return state
      const inspected = { ...state.inspected }
      delete inspected[documentId]
      return { inspected }
    }),
}))

/** The channel shown flat, or `null` when the document shows its material under light. */
export function inspectedChannel(
  state: Pick<TextureViewsState, 'inspected'>,
  documentId: string,
): PbrChannel | null {
  return state.inspected[documentId] ?? null
}
