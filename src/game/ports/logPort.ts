// SPDX-License-Identifier: MIT

import type { LogEntry, LogLevel } from '@shared/domain/gameRuntime'

/**
 * What a game says about itself — what a console shows and what a report attaches. The entries
 * themselves are declared with the report, which the window and the main process also read.
 *
 * `recent` is bounded by the implementation: a game left running writes without end, and a log
 * that keeps everything is a leak with a nice name.
 */
export type LogPort = {
  write: (level: LogLevel, message: string) => void
  /** Oldest first, so a reader appends rather than reverses. */
  recent: () => readonly LogEntry[]
}

/** How many entries a host keeps. Enough to read back a fault, short enough to hold in memory. */
export const LOG_KEPT = 200
