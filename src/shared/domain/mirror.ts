/**
 * The video return: a window of its own showing the PROGRAM monitor and nothing else, meant to be
 * dropped on a second screen and watched while the edit happens in the studio.
 *
 * One window, never one per document — the route carries no document id for that reason. What it
 * shows is whichever sequence the studio is publishing, so opening the return from a second tab
 * turns the same window towards it rather than stacking a third one on the desk.
 */
export const MIRROR_ROUTE = 'mirror'

export function isMirrorRoute(hash: string): boolean {
  return hash.replace(/^#/, '') === MIRROR_ROUTE
}
