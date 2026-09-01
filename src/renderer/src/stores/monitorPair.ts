import { create } from 'zustand'

/**
 * Whether a montage tab also shows the half that plays ONE clip — the source monitor in the
 * picture space, the take editor in the sound one.
 *
 * Hidden by default: what a montage is for is the whole edit, and the half showing a single clip
 * is what one opens when a clip needs looking at on its own.
 *
 * Session state, and a store of its own for the reason `useMaterialViews` gives: how one is
 * looking at a document is not something one made of it, and it must not travel in the `.otio`.
 */
export type MonitorPairState = {
  clipShown: Record<string, boolean>
  toggleClipMonitor: (documentId: string) => void
  /** Dropped on close: the project folder hands ids out again. */
  forgetMonitorPair: (documentId: string) => void
}

export const useMonitorPair = create<MonitorPairState>()(set => ({
  clipShown: {},
  toggleClipMonitor: documentId =>
    set(state => ({
      clipShown: { ...state.clipShown, [documentId]: !state.clipShown[documentId] },
    })),
  forgetMonitorPair: documentId =>
    set(state => {
      if (!(documentId in state.clipShown)) return state
      const clipShown = { ...state.clipShown }
      delete clipShown[documentId]
      return { clipShown }
    }),
}))

/** Whether the one-clip half is on screen. False for a document nobody has asked about. */
export function isClipMonitorShown(
  state: Pick<MonitorPairState, 'clipShown'>,
  documentId: string,
): boolean {
  return state.clipShown[documentId] ?? false
}
