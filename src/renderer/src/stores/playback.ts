import { create } from 'zustand'
import type { Us } from '@shared/domain/time'
import { withoutKey } from '@/helpers/objects'

type PlaybackState = {
  /** Keyed by the name a player registered under in `transports`, never by document. */
  running: Record<string, boolean>
  /**
   * Playhead while a transport is running, keyed by document. Not an edit: writing the
   * sequence sixty times a second woke every subscriber for a number the clock already has.
   */
  heads: Record<string, Us>
  setRunning: (owner: string, running: boolean) => void
  setHead: (documentId: string, time: Us) => void
  forget: (owner: string) => void
}

/**
 * Which players are running, by the name they publish under (`engines/timeline/playback`).
 *
 * Session state, and outside the document for the same reason a viewport is: playing is not an
 * edit. It lives here rather than in the player because TWO surfaces read it at once — the
 * transport under the monitor's picture and the one on the timeline's own bar — and neither of
 * those trees contains the other. That is the same wall `transports` was built to cross: the
 * registry lets a surface ASK a player to run, this says whether it is.
 */
export const usePlayback = create<PlaybackState>()(set => ({
  running: {},
  heads: {},

  setRunning: (owner, running) =>
    set(state =>
      state.running[owner] === running
        ? state
        : { running: { ...state.running, [owner]: running } },
    ),

  setHead: (documentId, time) =>
    set(state =>
      state.heads[documentId] === time ? state : { heads: { ...state.heads, [documentId]: time } },
    ),

  forget: owner => set(state => ({ running: withoutKey(state.running, owner) })),
}))

/** A player nobody has heard from is not running. */
export function playbackOf(state: Pick<PlaybackState, 'running'>, owner: string): boolean {
  return state.running[owner] ?? false
}

export function playbackHeadOf(
  state: Pick<PlaybackState, 'heads'>,
  documentId: string,
): Us | undefined {
  return state.heads[documentId]
}
