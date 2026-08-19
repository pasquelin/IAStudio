import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { Sink } from '@main/log'

/** Two files at most, so the trace of a launch survives the one that follows it. */
const MAX_BYTES = 1_000_000
/** Exported so whoever points a reader at the log names the same file this one writes. */
export const CURRENT = 'main.log'
const PREVIOUS = 'main.1.log'

function sizeOf(file: string): number {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}

/** Written synchronously: a queued append loses the lines before a crash, which are the ones. */
export function createLogFile(directoryOf: () => string, maxBytes: number = MAX_BYTES): Sink {
  let folder: string | null = null
  let written = 0
  let stopped = false

  return entry => {
    if (stopped) return

    const line = `${new Date().toISOString()} ${entry.level} [${entry.scope}] ${entry.message}\n`
    const bytes = Buffer.byteLength(line)

    try {
      // The path itself is resolved here and not at start-up: a throw on the way to the folder
      // would otherwise take down whatever ran the launch, and the studio must open anyway.
      if (folder === null) {
        folder = directoryOf()
        mkdirSync(folder, { recursive: true })
        written = sizeOf(join(folder, CURRENT))
      }

      const current = join(folder, CURRENT)

      if (written + bytes > maxBytes) {
        // The count is this process's; only the disk says whether there is still a file to move.
        // One removed underneath us would otherwise raise ENOENT and end the recording for good.
        written = sizeOf(current)
        if (written > 0) {
          renameSync(current, join(folder, PREVIOUS))
          written = 0
        }
      }

      appendFileSync(current, line)
      written += bytes
    } catch (cause) {
      stopped = true
      // Reported straight to the terminal: going through `log` would come back here.
      console.error(
        `[log] no longer recording under ${folder ?? 'the log folder'}: ${String(cause)}`,
      )
    }
  }
}
