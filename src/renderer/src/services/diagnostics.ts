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
  // ⌘S is a gesture, and the half that reaches the asset can fail while the document is written.
  'assets.save',
  // Both rows of the home's project menu: chosen again precisely because the first attempt
  // said nothing, and a shelf whose row does nothing twice in silence reads as a dead menu.
  'project.reveal',
  'project.forget',
  // A drop is a gesture: dropping the same cloud picture twice must say so twice, which is the
  // very defect `feat/documents-erreurs` fixed for the others.
  'texture.channel',
  // And so is pressing Measure: the second press happens precisely because the first said
  // nothing, and a silent button is how a measurement that keeps failing looks like one that ran.
  'texture.seam',
  // Picking a row of the export menu is one as well, and it is the same row twice that says the
  // first attempt failed — silenced, a second try looks exactly like a dialog somebody dismissed.
  'texture.export',
  'skybox.export',
  // Pressing Run is one too, and the second press is exactly what says the first did nothing.
  'graph.run',
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

/**
 * A render React could not finish.
 *
 * The blamed component stands as the subject rather than the whole stack: the message becomes a
 * toast, and a toast is not where a stack is read. The deepest frame is the actionable line in
 * it, and it is also what dedupes a component that throws on every re-render.
 */
export function reportRenderFailure(error: unknown, componentStack: string | undefined): void {
  reportFailure('shell.render', blamedComponent(componentStack), error)
}

function blamedComponent(componentStack: string | undefined): string {
  return componentStack?.match(/^\s*at (\S+)/m)?.[1] ?? 'an unnamed component'
}

const reported = new Set<string>()

/** Lets a subject be reported again — the studio moved on, and a repeat would now be news. */
export function forgetReportedFailures(): void {
  reported.clear()
}
