// SPDX-License-Identifier: MIT

import type { LogEntry, LogLevel } from '@shared/domain/gameRuntime'
import { LOG_KEPT, type LogPort } from '../ports/logPort'

/**
 * Bounded: the oldest entry falls out when the newest arrives. `echo` is where a line ALSO goes,
 * and is optional because a host may have nowhere to send one.
 */
export function createRingLog(echo?: (entry: LogEntry) => void, limit: number = LOG_KEPT): LogPort {
  const kept: LogEntry[] = []

  return {
    write: (level: LogLevel, message: string) => {
      const entry: LogEntry = { level, message, at: Date.now() }
      kept.push(entry)
      if (kept.length > limit) kept.shift()
      echo?.(entry)
    },
    recent: () => [...kept],
  }
}
