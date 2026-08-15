import { create } from 'zustand'

type PlaybackState = {
  /** Keyed by the name a player registered under in `transports`, never by document. */
  running: Record<string, boolean>
  setRunning: (owner: string, running: boolean) => void
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

  setRunning: (owner, running) =>
    set(state =>
      state.running[owner] === running
        ? state
        : { running: { ...state.running, [owner]: running } },
    ),

  forget: owner =>
    set(state => {
      const { [owner]: gone, ...running } = state.running
      void gone
      return { running }
    }),
}))

/** A player nobody has heard from is not running. */
export function playbackOf(state: Pick<PlaybackState, 'running'>, owner: string): boolean {
  return state.running[owner] ?? false
}
