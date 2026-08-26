// SPDX-License-Identifier: MIT

export type LogLevel = 'info' | 'warn' | 'error'

export type LogEntry = { level: LogLevel; message: string; at: number }

/**
 * What a game says about itself. `recent` is bounded by the implementation: a game left running
 * writes without end, and a log that keeps everything is a leak with a nice name.
 */
export type LogPort = {
  write: (level: LogLevel, message: string) => void
  /** Oldest first, so a reader appends rather than reverses. */
  recent: () => readonly LogEntry[]
}

/** How many entries a host keeps. Enough to read back a fault, short enough to hold in memory. */
export const LOG_KEPT = 200
