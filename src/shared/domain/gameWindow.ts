/**
 * The game window: a scene played in a window of its own, the way a game engine plays one.
 *
 * One window, never one per document — the route carries no document id for that reason. What it
 * plays is whichever scene the studio is publishing, so pressing Play on a second tab turns the
 * same window towards it rather than stacking a second game on the desk.
 */
export const GAME_WINDOW_ROUTE = 'game'

export function isGameWindowRoute(hash: string): boolean {
  return hash.replace(/^#/, '') === GAME_WINDOW_ROUTE
}
