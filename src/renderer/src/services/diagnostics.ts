import { messageOf } from '@shared/guards'
import { isGestureScope, MAX_LOG_MESSAGE, type LogScope } from '@shared/ipc'
import { getBridge } from './bridge'

/**
 * Records a failure the renderer would otherwise swallow. Without this, a model that fails to
 * load is a node that draws nothing and says nothing.
 *
 * It goes to the main process, which owns the log, and from there into the project's journal —
 * which is what puts it on screen, as a toast and then as a line in the activity panel.
 *
 * Silent when there is no bridge — tests and a plain browser have none, exactly as everywhere
 * else `getBridge` is read.
 */
export function reportFailure(scope: LogScope, subject: string, error: unknown): void {
  // Said once per thing that failed — but only for the failures nobody asked for. A gesture
  // repeated is a question asked again, and it gets an answer every time: see `GESTURE_SCOPES`.
  if (!isGestureScope(scope)) {
    const said = `${scope}:${subject}`
    if (reported.has(said)) return
    reported.add(said)
  }

  const message = `${subject}: ${messageOf(error)}`.slice(0, MAX_LOG_MESSAGE)

  // The rejection is dropped on purpose: this IS the path a failure travels, and a failure to
  // report one has nowhere left to go.
  getBridge()
    ?.diagnostics.report({ level: 'error', scope, message })
    .catch(() => {})
}

const reported = new Set<string>()

/** Lets a subject be reported again — the studio moved on, and a repeat would now be news. */
export function forgetReportedFailures(): void {
  reported.clear()
}
