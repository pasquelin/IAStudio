import type { RootOptions } from 'react-dom/client'
import { reportRenderFailure, traceFailure } from '@/services/diagnostics'

/**
 * How a render that threw reaches the log, for every boundary of the tree at once — the log
 * belongs to the main process, and a `console.error` in a component leaves nothing behind in a
 * packaged build.
 *
 * Both hooks, not only the caught one: a throw in `Failure`, or in a boundary's own render, is
 * caught by nothing and makes React unmount the whole tree. A blank window is the last case that
 * may stay silent.
 *
 * Exported rather than written inline at `createRoot` because the wiring is one argument, and
 * nothing else in the application would notice its removal.
 */
export const ROOT_ERROR_REPORTING: Pick<RootOptions, 'onCaughtError' | 'onUncaughtError'> = {
  onCaughtError: (error, info) => reportRenderFailure(error, info.componentStack),
  onUncaughtError: (error, info) => reportRenderFailure(error, info.componentStack),
}

/**
 * The other half of the window's silence, and the one React has no hook for: a promise nobody
 * awaited. The calls that cross to the main process throw their answer away by design — a
 * rename that fails on a full disk rejects into a window listening for nothing at all.
 *
 * It traces rather than reports. There is no gesture to name — the rejection arrives long after
 * whatever started it returned — and interrupting the reader over something already lost is what
 * made the first attempt at this a defect of its own.
 *
 * Returns its own removal so a window that unmounts stops writing under the next one's name;
 * nothing in the application calls it today, and a listener the window owns for its whole life
 * is what this is.
 */
export function traceDroppedRejections(): () => void {
  const onRejection = (event: PromiseRejectionEvent) =>
    traceFailure('shell.dropped', blamedThrower(event.reason), event.reason)

  window.addEventListener('unhandledrejection', onRejection)
  return () => window.removeEventListener('unhandledrejection', onRejection)
}

/**
 * What kind of thing rejected, as the subject. A constant there would have been worse than
 * nothing: it reads as one recurring failure in the log, whatever actually threw.
 */
function blamedThrower(reason: unknown): string {
  return reason instanceof Error ? reason.name : typeof reason
}
