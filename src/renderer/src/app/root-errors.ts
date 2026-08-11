import type { RootOptions } from 'react-dom/client'
import { reportRenderFailure } from '@/services/diagnostics'

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
