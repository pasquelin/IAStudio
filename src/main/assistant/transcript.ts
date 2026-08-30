import { log, logsSilenced } from '@main/log'
import { createRotatingFile } from '@main/logFile'

/**
 * What was sent to a model and what came back, WHOLE — the one place a briefing survives.
 *
 * 🛑 Its own file rather than `main.log`, which turns over at a megabyte: a briefing runs to
 * 90 505 characters on a door with room (measured 2026-08-30, 281 actions shown), so three turns
 * would have rotated it out from under everything else it holds.
 *
 * 🛑 Its blind spots, both written rather than hidden: nothing in a block names the WINDOW, so
 * two windows conversing at once interleave here with no way to tell their turns apart — and
 * `getPath('logs')` does not follow `--user-data-dir`, so two studios of the same build share
 * this file and each holds its own idea of how full it is.
 */
export const TRANSCRIPT = 'assistant.log'

/** `[M]` Some two hundred round trips of the widest briefing there is — 20 Mo / 90 505. */
const MAX_BYTES = 20_000_000

export type Transcript = (whole: string) => void

export function createTranscript(directoryOf: () => string, maxBytes = MAX_BYTES): Transcript {
  const append = createRotatingFile(directoryOf, {
    current: TRANSCRIPT,
    previous: 'assistant.1.log',
    maxBytes,
    scope: 'assistant',
    // Through `log`, which writes elsewhere: a file that stops mid-conversation with nothing
    // saying so reads as a studio that fell silent.
    onStopped: said => log.error('assistant', said),
  })

  return whole => {
    // 🛑 The technical journal turned off means turned off: this writes every sentence typed, the
    // project's context and where this person keeps their folders.
    if (logsSilenced()) return

    append(`\n===== ${new Date().toISOString()} =====\n${whole}\n`)
  }
}
