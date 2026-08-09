import { messageOf } from '@shared/guards'
import { MAX_LOG_MESSAGE, type LogScope } from '@shared/ipc'
import { getBridge } from './bridge'

/**
 * The scopes whose failures follow a gesture the user made — a ⌘S, an export, a tab closed.
 *
 * They are reported every time. Everything else is reported once per subject, because an engine
 * is rebuilt on every detach and every reopen (invariant 3) and asks again for the same missing
 * asset: without that, a project whose folder moved refills the journal on each detach. That is
 * also why `document.load` is NOT here — it is reported from a mount effect, not from a gesture.
 *
 * A repeated gesture is the opposite case. Somebody pressed the key a second time precisely
 * because the first did nothing, and answering that with silence is how a save that keeps
 * failing looks like a save that worked.
 *
 * Here rather than in `shared/ipc.ts`: nothing about this crosses the boundary. It is what this
 * module does with a scope, not what a scope is.
 */
const GESTURE_SCOPES: ReadonlySet<LogScope> = new Set<LogScope>([
  'scene.export',
  'image.export',
  'document.save',
  'document.close',
  'document.delete',
  'assets.reveal',
  // A double-click is a gesture too: refusing the same asset twice must say so twice.
  'assets.open',
  // A drop is a gesture: dropping the same cloud picture twice must say so twice, which is the
  // very defect `feat/documents-erreurs` fixed for the others.
  'texture.channel',
  // And so is pressing Measure: the second press happens precisely because the first said
  // nothing, and a silent button is how a measurement that keeps failing looks like one that ran.
  'texture.seam',
  // Picking a row of the export menu is one as well, and it is the same row twice that says the
  // first attempt failed — silenced, a second try looks exactly like a dialog somebody dismissed.
  'texture.export',
])

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
  // Said once per thing that failed — but only for the failures nobody asked for.
  if (!GESTURE_SCOPES.has(scope)) {
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
