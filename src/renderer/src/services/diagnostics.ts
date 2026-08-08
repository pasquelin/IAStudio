import { messageOf } from '@shared/guards'
import { MAX_LOG_MESSAGE, type LogScope } from '@shared/ipc'
import { getBridge } from './bridge'

/**
 * Records a failure the renderer would otherwise swallow. The log belongs to the main process,
 * and the studio has no error surface yet: without this, a model that fails to load is a node
 * that draws nothing and says nothing.
 *
 * Silent when there is no bridge — tests and a plain browser have none, exactly as everywhere
 * else `getBridge` is read.
 */
export function reportFailure(scope: LogScope, subject: string, error: unknown): void {
  // Said once per thing that failed. An engine is rebuilt whenever a panel is detached or a
  // document reopens (invariant 3), and each rebuild asks for every missing asset again — a
  // project whose folder moved would otherwise refill the log on every detach.
  const said = `${scope}:${subject}`
  if (reported.has(said)) return
  reported.add(said)

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
