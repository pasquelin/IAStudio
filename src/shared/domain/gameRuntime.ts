/**
 * What a running game says about itself — read by the panel that drives it, and by MCP.
 *
 * In `shared/` because three trees read it: the runtime writes it, the window draws it, and the
 * main process publishes it. Only `shared` sits below all three.
 */
export type PlayState = 'edit' | 'playing' | 'paused'

export type LogLevel = 'info' | 'warn' | 'error'

export type LogEntry = { level: LogLevel; message: string; at: number }

export type RuntimeReport = {
  state: PlayState
  /** The unit the network counts in, and what a bug report is anchored on. */
  tick: number
  fps: number
  frameMs: number
  entities: number
  /** Bounded by whoever fills it: a game left running writes without end. */
  logs: readonly LogEntry[]
}

export const NOT_PLAYING: RuntimeReport = {
  state: 'edit',
  tick: 0,
  fps: 0,
  frameMs: 0,
  entities: 0,
  logs: [],
}
