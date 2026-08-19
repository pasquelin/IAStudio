import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Sink } from '@main/log'

/** Two files at most, so the trace of a launch survives the one that follows it. */
const MAX_BYTES = 1_000_000
const CURRENT = 'main.log'
const PREVIOUS = 'main.1.log'

function sizeOf(file: string): number {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}

/** Written synchronously: a queued append loses the lines before a crash, which are the ones. */
export function createLogFile(directory: string, maxBytes: number = MAX_BYTES): Sink {
  const current = join(directory, CURRENT)
  let written: number | null = null
  let stopped = false

  return entry => {
    if (stopped) return

    const line = `${new Date().toISOString()} ${entry.level} [${entry.scope}] ${entry.message}\n`
    const bytes = Buffer.byteLength(line)

    try {
      // Reached on the first line, never at start-up: the studio opens where nothing can be written.
      if (written === null) {
        mkdirSync(directory, { recursive: true })
        written = sizeOf(current)
      }

      if (written > 0 && written + bytes > maxBytes) {
        renameSync(current, join(directory, PREVIOUS))
        written = 0
      }

      appendFileSync(current, line)
      written += bytes
    } catch (cause) {
      stopped = true
      // Reported straight to the terminal: going through `log` would come back here.
      console.error(`[log] no longer recording to ${current}: ${String(cause)}`)
    }
  }
}
