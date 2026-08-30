import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import type { Sink } from '@main/log'

/** Two files at most, so the trace of a launch survives the one that follows it. */
const MAX_BYTES = 1_000_000
/** Exported so whoever points a reader at the log names the same file this one writes. */
export const CURRENT = 'main.log'
const PREVIOUS = 'main.1.log'

/** 🛑 `setAppLogsPath()` is what DEFINES the path at all on Linux and Windows. */
export function logsFolder(): string {
  app.setAppLogsPath()
  return app.getPath('logs')
}

function sizeOf(file: string): number {
  try {
    return statSync(file).size
  } catch {
    return 0
  }
}

/** What a rotating file is: two names, a ceiling, and a scope to blame when it stops. */
export type RotatingFile = {
  current: string
  previous: string
  maxBytes: number
  /** Named in the one message this writes to the terminal, being unable to log its own failure. */
  scope: string
  /**
   * Told once, when this stops for good — ENOSPC, a rename Windows refuses, a volume unmounted.
   *
   * 🛑 `createLogFile` passes none, being the thing a report would go through; a recorder BESIDE
   * it passes one, or a reader is handed a file that stops mid-conversation saying why nowhere.
   */
  onStopped?: (cause: string) => void
}

/**
 * Appends text to a file that turns over at a ceiling, keeping one generation behind it.
 *
 * Written synchronously: a queued append loses the lines before a crash, which are the ones.
 */
export function createRotatingFile(
  directoryOf: () => string,
  file: RotatingFile,
): (text: string) => void {
  let folder: string | null = null
  let written = 0
  let stopped = false

  return text => {
    if (stopped) return

    const bytes = Buffer.byteLength(text)

    try {
      // The path itself is resolved here and not at start-up: a throw on the way to the folder
      // would otherwise take down whatever ran the launch, and the studio must open anyway.
      if (folder === null) {
        folder = directoryOf()
        mkdirSync(folder, { recursive: true })
        written = sizeOf(join(folder, file.current))
      }

      const current = join(folder, file.current)

      if (written + bytes > file.maxBytes) {
        // The count is this process's; only the disk says whether there is still a file to move.
        // One removed underneath us would otherwise raise ENOENT and end the recording for good.
        written = sizeOf(current)
        if (written > 0) {
          renameSync(current, join(folder, file.previous))
          written = 0
        }
      }

      appendFileSync(current, text)
      written += bytes
    } catch (cause) {
      stopped = true
      const said = `no longer recording under ${folder ?? 'the log folder'}: ${String(cause)}`
      // Straight to the terminal too: a recorder that can only report through itself says nothing.
      console.error(`[${file.scope}] ${said}`)
      file.onStopped?.(said)
    }
  }
}

export function createLogFile(directoryOf: () => string, maxBytes: number = MAX_BYTES): Sink {
  const append = createRotatingFile(directoryOf, {
    current: CURRENT,
    previous: PREVIOUS,
    maxBytes,
    scope: 'log',
  })

  return entry =>
    append(`${new Date().toISOString()} ${entry.level} [${entry.scope}] ${entry.message}\n`)
}
