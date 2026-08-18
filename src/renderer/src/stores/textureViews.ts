import { create } from 'zustand'
import type { PbrChannel } from '@shared/domain/texture'

/**
 * Which channel of each texture is being looked at on its own, or `null` for the lit material.
 *
 * Session state, and a store of its own for the reason `useCanvasViews` gives: how one is looking
 * at a document is not something one made of it. Inspecting a normal map flat must not travel in
 * the `.mtlx`, and ⌘Z must not give the sphere back.
 */
/**
 * A ratio, and the picture it was read off. The asset is half the reading: replace the base
 * colour and "Visible seam" would otherwise stay on screen for pixels that are no longer there.
 */
export type SeamReading = { assetId: string; ratio: number }

export type TextureViewsState = {
  inspected: Record<string, PbrChannel | null>
  /**
   * The last seam reading of each texture, or absent when none was asked for. Session state and
   * not a document field on purpose: it describes the base colour as it is right now, and one
   * saved into the `.mtlx` would be a measurement of pixels the file no longer points at.
   */
  seams: Record<string, SeamReading>
  inspect: (documentId: string, channel: PbrChannel | null) => void
  setSeam: (documentId: string, reading: SeamReading) => void
  /** Dropped on close: the project folder hands ids out again, and a document reopened later must
   * not open on the flat view of the one before it. */
  forget: (documentId: string) => void
}

export const useTextureViews = create<TextureViewsState>()(set => ({
  inspected: {},
  seams: {},
  inspect: (documentId, channel) =>
    set(state => ({ inspected: { ...state.inspected, [documentId]: channel } })),
  setSeam: (documentId, reading) =>
    set(state => ({ seams: { ...state.seams, [documentId]: reading } })),
  forget: documentId =>
    set(state => {
      if (!(documentId in state.inspected) && !(documentId in state.seams)) return state
      const inspected = { ...state.inspected }
      delete inspected[documentId]
      const seams = { ...state.seams }
      delete seams[documentId]
      return { inspected, seams }
    }),
}))

/** The last seam reading, or `null` when none was asked for. */
export function seamOf(
  state: Pick<TextureViewsState, 'seams'>,
  documentId: string,
): SeamReading | null {
  return state.seams[documentId] ?? null
}

/** The channel shown flat, or `null` when the document shows its material under light. */
export function inspectedChannel(
  state: Pick<TextureViewsState, 'inspected'>,
  documentId: string,
): PbrChannel | null {
  return state.inspected[documentId] ?? null
}
